// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';

// ws est nécessaire pour Node.js < 22 (pas de WebSocket natif)
const realtimeOptions = typeof WebSocket === 'undefined'
  ? { transport: (await import('ws')).default }
  : {};

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
  realtime: {
    ...realtimeOptions,
    params: {
      eventsPerSecond: 10
    }
  }
});

// Types dérivés du schéma
export type StatutFile = 'OUVERTE' | 'PAUSE' | 'FERMEE';
export type StatutTicket = 'EN_ATTENTE' | 'APPELE' | 'TRAITE' | 'ABSENT';

export interface Commerce {
  id: string;
  nom: string;
  slug: string;
  statut_file: StatutFile;
  dernier_ticket_appele: number;
  owner_id: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  commerce_id: string;
  numero_ordre: number;
  statut: StatutTicket;
  nom_client: string | null;
  push_sub: string | null;
  cree_a: string;
  appele_a: string | null;
}

export interface PushSubscription {
  id: string;
  ticket_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}