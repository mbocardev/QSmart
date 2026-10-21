// src/routes/api/scan/+server.ts
// Point d'entrée API pour la validation du QR code et l'attribution du ticket.
// Toute la logique de sécurité se passe ici, côté serveur.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { validerTokenQR } from '$lib/utils/token';

// Client admin (service role) — jamais exposé côté client
const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  let body: { token?: string; nomClient?: string };

  try {
    body = await request.json();
  } catch {
    return json({ succes: false, message: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { token, nomClient } = body;

  if (!token) {
    return json({ succes: false, message: 'Jeton manquant.' }, { status: 400 });
  }

  // ── Étape 1 : Décoder le token pour extraire l'ID du commerce ──────────────
  let commerceId: string;
  try {
    const decoded = atob(token);
    commerceId = decoded.split(':')[0];
    if (!commerceId) throw new Error('ID commerce manquant');
  } catch {
    return json(
      { succes: false, message: 'Code QR invalide. Scannez le code sur l\'écran en magasin.' },
      { status: 400 }
    );
  }

  // ── Étape 2 : Récupérer la clé secrète du commerce ────────────────────────
  const { data: commerce, error: comErr } = await supabaseAdmin
    .from('commerces')
    .select('id, nom, cle_secrete, statut_file')
    .eq('id', commerceId)
    .single();

  if (comErr || !commerce) {
    return json({ succes: false, message: 'Commerce introuvable.' }, { status: 404 });
  }

  // ── Étape 3 : Valider la signature TOTP ───────────────────────────────────
  const validation = validerTokenQR(token, commerce.cle_secrete);
  if (!validation.valide) {
    return json({ succes: false, message: validation.raison }, { status: 401 });
  }

  // ── Étape 4 : Vérifier que la file est ouverte ────────────────────────────
  if (commerce.statut_file !== 'OUVERTE') {
    const messages: Record<string, string> = {
      PAUSE: 'La file est momentanément suspendue. Réessayez dans quelques minutes.',
      FERMEE: 'Les inscriptions sont fermées pour aujourd\'hui.'
    };
    return json(
      { succes: false, message: messages[commerce.statut_file] ?? 'File indisponible.' },
      { status: 403 }
    );
  }

  // ── Étape 5 : Attribuer le ticket de manière atomique ─────────────────────
  // La fonction SQL gère le verrou FOR UPDATE → zéro doublon possible
  const { data: ticket, error: ticketErr } = await supabaseAdmin.rpc('attribuer_ticket', {
    p_commerce_id: commerceId,
    p_nom_client: nomClient ?? null
  });

  if (ticketErr) {
    // Distinguer les erreurs métier des erreurs techniques
    if (ticketErr.message.includes('FILE_FERMEE')) {
      return json({ succes: false, message: 'La file vient d\'être fermée.' }, { status: 403 });
    }
    console.error('Erreur attribution ticket:', ticketErr);
    return json({ succes: false, message: 'Erreur serveur. Réessayez.' }, { status: 500 });
  }

  // ── Étape 6 : Calculer la position dans la file ───────────────────────────
  const { count: positionAvant } = await supabaseAdmin
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('commerce_id', commerceId)
    .eq('statut', 'EN_ATTENTE')
    .lt('numero_ordre', ticket.numero_ordre);

  return json({
    succes: true,
    ticket: {
      id: ticket.id,
      numero: ticket.numero_ordre,
      commerceNom: commerce.nom,
      commerceId: commerce.id,
      positionAvant: positionAvant ?? 0,
      tempsEstimeMinutes: Math.round((positionAvant ?? 0) * 4.5)
    }
  });
};
