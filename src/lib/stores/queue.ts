// src/lib/stores/queue.ts
// Store Svelte pour la file d'attente en temps réel
// Utilise Supabase Realtime pour synchroniser toutes les interfaces

import { writable, derived, get } from 'svelte/store';
import { supabase, type Commerce, type Ticket } from '$lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Stores principaux ───────────────────────────────────────────────────────

export const commerce = writable<Commerce | null>(null);
export const tickets = writable<Ticket[]>([]);
export const loading = writable(true);
export const erreur = writable<string | null>(null);

// ─── Stores dérivés ──────────────────────────────────────────────────────────

export const ticketsEnAttente = derived(tickets, ($t) =>
  $t.filter((t) => t.statut === 'EN_ATTENTE').sort((a, b) => a.numero_ordre - b.numero_ordre)
);

export const ticketAppele = derived(tickets, ($t) => $t.find((t) => t.statut === 'APPELE') ?? null);

export const ticketsTraites = derived(tickets, ($t) => $t.filter((t) => t.statut === 'TRAITE'));

export const tempsAttenteEstime = derived(ticketsEnAttente, ($en_attente) => {
  // Moyenne de 4.5 minutes par client (ajustable selon historique réel)
  return $en_attente.length * 4.5;
});

// ─── Canal Realtime ───────────────────────────────────────────────────────────

let channel: RealtimeChannel | null = null;

/**
 * Initialise le store pour un commerce donné.
 * S'abonne aux changements Realtime sur tickets et commerces.
 */
export async function initQueue(commerceId: string): Promise<void> {
  loading.set(true);
  erreur.set(null);

  // Charger le commerce
  const { data: com, error: comErr } = await supabase
    .from('commerces')
    .select('*')
    .eq('id', commerceId)
    .single();

  if (comErr || !com) {
    erreur.set('Commerce introuvable.');
    loading.set(false);
    return;
  }
  commerce.set(com);

  // Charger les tickets du jour
  await rechargerTickets(commerceId);
  loading.set(false);

  // S'abonner aux changements Realtime
  if (channel) channel.unsubscribe();

  channel = supabase
    .channel(`queue:${commerceId}`)
    // Changements sur les tickets du commerce
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `commerce_id=eq.${commerceId}`
      },
      (payload) => {
        tickets.update((current) => {
          if (payload.eventType === 'INSERT') {
            return [...current, payload.new as Ticket];
          }
          if (payload.eventType === 'UPDATE') {
            return current.map((t) =>
              t.id === (payload.new as Ticket).id ? (payload.new as Ticket) : t
            );
          }
          if (payload.eventType === 'DELETE') {
            return current.filter((t) => t.id !== (payload.old as Ticket).id);
          }
          return current;
        });
      }
    )
    // Changements sur le commerce (statut, numéro en cours)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'commerces',
        filter: `id=eq.${commerceId}`
      },
      (payload) => {
        commerce.set(payload.new as Commerce);
      }
    )
    .subscribe();
}

async function rechargerTickets(commerceId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('commerce_id', commerceId)
    .gte('cree_a', `${today}T00:00:00`)
    .order('numero_ordre', { ascending: true });

  if (error) {
    erreur.set('Erreur lors du chargement des tickets.');
    return;
  }
  tickets.set(data ?? []);
}

/**
 * Nettoyage : se désabonner du canal Realtime.
 */
export function cleanupQueue(): void {
  if (channel) {
    channel.unsubscribe();
    channel = null;
  }
}

// ─── Actions Gérant ───────────────────────────────────────────────────────────

export async function appelerSuivant(commerceId: string): Promise<{ erreur?: string }> {
  const { data, error } = await supabase.rpc('appeler_suivant', {
    p_commerce_id: commerceId
  });
  if (error) return { erreur: error.message };
  return {};
}

export async function marquerAbsent(ticketId: string): Promise<{ erreur?: string }> {
  const { error } = await supabase
    .from('tickets')
    .update({ statut: 'ABSENT' })
    .eq('id', ticketId);
  if (error) return { erreur: error.message };
  return {};
}

export async function ajouterTicketManuel(
  commerceId: string,
  nomClient?: string
): Promise<{ ticket?: Ticket; erreur?: string }> {
  const { data, error } = await supabase.rpc('attribuer_ticket', {
    p_commerce_id: commerceId,
    p_nom_client: nomClient ?? 'Ticket physique'
  });
  if (error) return { erreur: error.message };
  return { ticket: data };
}

export async function changerStatutFile(
  commerceId: string,
  statut: 'OUVERTE' | 'PAUSE' | 'FERMEE'
): Promise<{ erreur?: string }> {
  const { error } = await supabase
    .from('commerces')
    .update({ statut_file: statut })
    .eq('id', commerceId);
  if (error) return { erreur: error.message };
  return {};
}

export async function reinitialiserFile(commerceId: string): Promise<{ erreur?: string }> {
  const today = new Date().toISOString().split('T')[0];
  // Marquer tous les tickets du jour comme TRAITE (conservation historique)
  const { error } = await supabase
    .from('tickets')
    .update({ statut: 'TRAITE' })
    .eq('commerce_id', commerceId)
    .gte('cree_a', `${today}T00:00:00`)
    .in('statut', ['EN_ATTENTE', 'APPELE']);

  if (error) return { erreur: error.message };

  // Remettre le compteur à 0
  await supabase
    .from('commerces')
    .update({ dernier_ticket_appele: 0 })
    .eq('id', commerceId);

  tickets.set([]);
  return {};
}
