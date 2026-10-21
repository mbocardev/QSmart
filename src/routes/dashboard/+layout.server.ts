// src/routes/dashboard/+layout.server.ts
// Guard serveur : redirige vers / si l'utilisateur n'est pas connecté.

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Supabase SSR session (configuré via hooks.server.ts)
  const session = locals.session;
  if (!session) {
    throw redirect(303, '/');
  }
  return { session };
};
