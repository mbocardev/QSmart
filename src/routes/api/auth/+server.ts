import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';

export async function POST({ request, cookies }) {
  const { email, password, mode } = await request.json();

  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    realtime: { transport: ws },
    auth: { persistSession: false }
  });

  const { data, error } = mode === 'inscription'
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });

  if (error) return json({ error: error.message }, { status: 400 });

  if (data.session) {
    cookies.set('sb-access-token', data.session.access_token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });
    cookies.set('sb-refresh-token', data.session.refresh_token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });
  }

  return json({ ok: true });
}