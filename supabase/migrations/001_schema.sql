-- ============================================================
-- Q-Smart — Schéma PostgreSQL complet
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLE : commerces
-- ============================================================
create table public.commerces (
  id           uuid primary key default uuid_generate_v4(),
  nom          varchar(120) not null,
  slug         varchar(80)  unique not null,  -- ex: pharmacie-al-amine
  cle_secrete  varchar(64)  not null default encode(gen_random_bytes(32), 'hex'),
  statut_file  text         not null default 'OUVERTE'
                            check (statut_file in ('OUVERTE','PAUSE','FERMEE')),
  dernier_ticket_appele integer not null default 0,
  owner_id     uuid references auth.users(id) on delete cascade,
  created_at   timestamptz  not null default now()
);

-- ============================================================
-- TABLE : tickets (CORRIGÉE)
-- ============================================================
create table public.tickets (
  id           uuid primary key default uuid_generate_v4(),
  commerce_id  uuid not null references public.commerces(id) on delete cascade,
  numero_ordre integer not null,
  statut       text not null default 'EN_ATTENTE'
               check (statut in ('EN_ATTENTE','APPELE','TRAITE','ABSENT')),
  nom_client   varchar(80),
  push_sub     text,           -- JSON stringifié de la PushSubscription du client
  cree_a       timestamptz not null default now(),
  appele_a     timestamptz
);

-- Contrainte d'unicité via un index unique figé sur UTC
create unique index idx_tickets_unique_ordre_par_jour 
  on public.tickets (commerce_id, numero_ordre, ((cree_a at time zone 'UTC')::date));

-- Index pour accélérer les requêtes "file du jour" figé sur UTC
create index idx_tickets_commerce_date
  on public.tickets (commerce_id, ((cree_a at time zone 'UTC')::date), statut);
  
-- ============================================================
-- TABLE : push_subscriptions
-- Stocke les abonnements Web Push par ticket
-- ============================================================
create table public.push_subscriptions (
  id           uuid primary key default uuid_generate_v4(),
  ticket_id    uuid not null references public.tickets(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth_key     text not null,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- FONCTION : attribution atomique de numéro (anti-doublon)
-- Utilisée par l'API /api/scan pour le rush de midi
-- ============================================================
create or replace function public.attribuer_ticket(
  p_commerce_id uuid,
  p_nom_client  varchar default null
)
returns public.tickets
language plpgsql
security definer
as $$
declare
  v_commerce    public.commerces;
  v_next_num    integer;
  v_ticket      public.tickets;
begin
  -- Verrouillage de la ligne commerce (SELECT FOR UPDATE)
  -- Garantit qu'aucun doublon n'est possible même en cas de requêtes simultanées
  select * into v_commerce
  from public.commerces
  where id = p_commerce_id
  for update;

  -- Vérifier que la file est ouverte
  if v_commerce.statut_file != 'OUVERTE' then
    raise exception 'FILE_FERMEE: La file n''est pas ouverte pour ce commerce.';
  end if;

  -- Calculer le prochain numéro du jour
  select coalesce(max(numero_ordre), 0) + 1
  into v_next_num
  from public.tickets
  where commerce_id = p_commerce_id
    and cree_a::date = current_date;

  -- Insérer le ticket
  insert into public.tickets (commerce_id, numero_ordre, nom_client, statut)
  values (p_commerce_id, v_next_num, p_nom_client, 'EN_ATTENTE')
  returning * into v_ticket;

  return v_ticket;
end;
$$;

-- ============================================================
-- FONCTION : appeler le ticket suivant
-- ============================================================
create or replace function public.appeler_suivant(p_commerce_id uuid)
returns public.tickets
language plpgsql
security definer
as $$
declare
  v_next   public.tickets;
  v_called public.tickets;
begin
  -- Marquer l'actuel comme TRAITE
  update public.tickets
  set statut = 'TRAITE'
  where commerce_id = p_commerce_id
    and statut = 'APPELE'
    and cree_a::date = current_date;

  -- Récupérer le prochain EN_ATTENTE
  select * into v_next
  from public.tickets
  where commerce_id = p_commerce_id
    and statut = 'EN_ATTENTE'
    and cree_a::date = current_date
  order by numero_ordre asc
  limit 1
  for update skip locked;

  if not found then
    raise exception 'FILE_VIDE: Aucun client en attente.';
  end if;

  -- Mettre à jour le ticket
  update public.tickets
  set statut = 'APPELE', appele_a = now()
  where id = v_next.id
  returning * into v_called;

  -- Mettre à jour le compteur du commerce
  update public.commerces
  set dernier_ticket_appele = v_next.numero_ordre
  where id = p_commerce_id;

  return v_called;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.commerces enable row level security;
alter table public.tickets enable row level security;
alter table public.push_subscriptions enable row level security;

-- Commerces : le gérant voit et modifie seulement son commerce
create policy "Gerant voit son commerce"
  on public.commerces for select
  using (owner_id = auth.uid());

create policy "Gerant modifie son commerce"
  on public.commerces for update
  using (owner_id = auth.uid());

-- Tickets : le gérant voit les tickets de son commerce
create policy "Gerant voit ses tickets"
  on public.tickets for select
  using (
    commerce_id in (
      select id from public.commerces where owner_id = auth.uid()
    )
  );

-- Tickets : lecture publique pour le kiosque et les clients (par commerce_id)
create policy "Lecture publique tickets du jour"
  on public.tickets for select
  using (cree_a::date = current_date);

-- Push subs : insertion publique (le client s'abonne lui-même)
create policy "Client peut inserer push sub"
  on public.push_subscriptions for insert
  with check (true);

-- ============================================================
-- REALTIME : activer la publication sur les tables clés
-- ============================================================
begin;
  -- Activer Realtime sur tickets et commerces
  alter publication supabase_realtime add table public.tickets;
  alter publication supabase_realtime add table public.commerces;
commit;

-- ============================================================
-- DONNÉES DE TEST (optionnel — commenter en production)
-- ============================================================
/*
insert into public.commerces (nom, slug, statut_file, owner_id)
values
  ('Pharmacie Al-Amine', 'pharmacie-al-amine', 'OUVERTE', null),
  ('Boulangerie Ndar', 'boulangerie-ndar', 'PAUSE', null),
  ('Cabinet Dr. Fall', 'cabinet-dr-fall', 'OUVERTE', null);
*/
