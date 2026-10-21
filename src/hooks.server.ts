// src/hooks.server.ts
import { createClient } from '@supabase/supabase-js';
import type { Handle } from '@sveltejs/kit';
import ws from 'ws';
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    realtime: { transport: ws },
    auth: {
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  const accessToken = event.cookies.get('sb-access-token');
  const refreshToken = event.cookies.get('sb-refresh-token');

  if (accessToken && refreshToken) {
    const { data } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    // Rafraîchir les cookies si le token a été renouvelé
    if (data.session) {
      event.cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });
      event.cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30
      });
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  event.locals.session = session;

  return resolve(event);
};