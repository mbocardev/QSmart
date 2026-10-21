// src/routes/api/push/subscribe/+server.ts
// Sauvegarde d'une PushSubscription Web Push en base de données.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  const { ticketId, pushSub } = await request.json();

  if (!ticketId || !pushSub) {
    return json({ succes: false }, { status: 400 });
  }

  let sub: { endpoint: string; keys: { p256dh: string; auth: string } };
  try {
    sub = JSON.parse(pushSub);
  } catch {
    return json({ succes: false, message: 'PushSubscription invalide.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('push_subscriptions').insert({
    ticket_id: ticketId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth_key: sub.keys.auth
  });

  if (error) {
    return json({ succes: false }, { status: 500 });
  }

  return json({ succes: true });
};
