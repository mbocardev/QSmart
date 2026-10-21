// src/routes/api/qr/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticator } from 'otplib';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const STEP_SECONDS = 15;
authenticator.options = { step: STEP_SECONDS, window: 2, digits: 8 };

export const GET: RequestHandler = async ({ params }) => {
  const commerceId = params.id;

  // Requête HTTP directe à l'API REST Supabase — pas de WebSocket, pas de Realtime
  const res = await fetch(
    `${PUBLIC_SUPABASE_URL}/rest/v1/commerces?id=eq.${commerceId}&select=cle_secrete&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!res.ok) {
    throw error(500, 'Erreur Supabase: ' + res.statusText);
  }

  const rows = await res.json();

  if (!rows?.length || !rows[0]?.cle_secrete) {
    throw error(404, 'Commerce introuvable ou clé manquante');
  }

  const cleSecrete = rows[0].cle_secrete;
  const token = authenticator.generate(cleSecrete);
  const payload = `${commerceId}:${token}`;
  const tokenBase64 = Buffer.from(payload).toString('base64');

  return json({ token: tokenBase64 });
};
