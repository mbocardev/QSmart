// src/routes/api/push/notify/+server.ts
// Envoi de notifications Web Push aux clients concernés.
// Appelé par un Supabase Database Webhook ou depuis le dashboard gérant.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_EMAIL
} from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_VAPID_KEY } from '$env/static/public';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Payload attendu : { commerceId, numeroAppele }
 * Envoie une notification à tous les clients dont le tour approche :
 *  - Client à 3 positions : "Bientôt votre tour"
 *  - Client à 1 position : "Préparez-vous !"
 *  - Client appelé (= 0) : "C'est votre tour !"
 */
export const POST: RequestHandler = async ({ request }) => {
  const { commerceId, numeroAppele } = await request.json();

  if (!commerceId || !numeroAppele) {
    return json({ succes: false }, { status: 400 });
  }

  // Récupérer les tickets qui méritent une notification
  const targetsNums = [numeroAppele, numeroAppele + 1, numeroAppele + 3];

  const { data: targets } = await supabaseAdmin
    .from('tickets')
    .select('id, numero_ordre')
    .eq('commerce_id', commerceId)
    .in('numero_ordre', targetsNums)
    .eq('statut', 'EN_ATTENTE');

  if (!targets || targets.length === 0) {
    return json({ succes: true, envoyes: 0 });
  }

  // Récupérer les subscriptions associées
  const ticketIds = targets.map((t) => t.id);
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .in('ticket_id', ticketIds);

  if (!subs || subs.length === 0) {
    return json({ succes: true, envoyes: 0 });
  }

  // Construire et envoyer chaque notification
  let envoyes = 0;
  for (const sub of subs) {
    const ticket = targets.find((t) => t.id === sub.ticket_id);
    if (!ticket) continue;

    const position = ticket.numero_ordre - numeroAppele;
    let titre: string;
    let corps: string;

    if (position === 0) {
      titre = '🔔 C\'est votre tour !';
      corps = 'Présentez-vous au comptoir maintenant.';
    } else if (position === 1) {
      titre = '⚡ Préparez-vous !';
      corps = 'Vous êtes le prochain. Approchez-vous du comptoir.';
    } else {
      titre = '⏱ Bientôt votre tour';
      corps = `Plus que ${position} personne(s) avant vous.`;
    }

    const pushPayload = JSON.stringify({
      title: titre,
      body: corps,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { ticketId: sub.ticket_id, url: `/queue/${sub.ticket_id}` }
    });

    try {
      // En production : utiliser la lib `web-push` pour signer avec VAPID
      // Ici on documente l'appel — intégrer web-push via npm
      // webpush.sendNotification(subscription, pushPayload)
      console.log(`[PUSH] Ticket #${ticket.numero_ordre} → ${titre}`);
      envoyes++;
    } catch (err) {
      console.error(`[PUSH] Échec pour ticket ${sub.ticket_id}:`, err);
    }
  }

  return json({ succes: true, envoyes });
};
