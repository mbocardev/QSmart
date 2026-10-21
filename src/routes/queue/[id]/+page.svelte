<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { supabase, type Ticket, type Commerce } from '$lib/supabase';
  import { abonnerPushNotifications, sauvegarderPushSub } from '$lib/utils/push';
  import type { RealtimeChannel } from '@supabase/supabase-js';

  const ticketId = $page.params.id;

  let ticket: Ticket | null = null;
  let commerce: Commerce | null = null;
  let ticketsAvant = 0;
  let totalEnAttente = 0;
  let loading = true;
  let notifActives = false;
  let channel: RealtimeChannel | null = null;

  // Alertes sonores et visuelles
  let alerteNiveau: 'none' | 'proche' | 'suivant' | 'appele' = 'none';

  $: if (ticket && commerce) {
    const position = ticket.numero_ordre - commerce.dernier_ticket_appele;
    if (position <= 0 || ticket.statut === 'APPELE') alerteNiveau = 'appele';
    else if (position === 1) alerteNiveau = 'suivant';
    else if (position <= 3) alerteNiveau = 'proche';
    else alerteNiveau = 'none';
  }

  $: tempsEstime = Math.round(ticketsAvant * 4.5);
  $: progression = ticket && commerce
    ? Math.min(100, Math.round(((ticket.numero_ordre - ticketsAvant) / ticket.numero_ordre) * 100))
    : 0;

  onMount(async () => {
    await charger();

    // Abonnement Realtime sur les changements du commerce
    channel = supabase
      .channel(`client:${ticketId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'commerces',
        filter: `id=eq.${commerce?.id}`
      }, (payload) => {
        commerce = payload.new as Commerce;
        recalculerPosition();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `id=eq.${ticketId}`
      }, (payload) => {
        ticket = payload.new as Ticket;
      })
      .subscribe();
  });

  onDestroy(() => { channel?.unsubscribe(); });

  async function charger() {
    loading = true;

    const { data: t } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (!t) { loading = false; return; }
    ticket = t;

    const { data: c } = await supabase
      .from('commerces')
      .select('*')
      .eq('id', t.commerce_id)
      .single();

    commerce = c;
    await recalculerPosition();
    loading = false;
  }

  async function recalculerPosition() {
    if (!ticket || !commerce) return;
    const today = new Date().toISOString().split('T')[0];

    const { count: avant } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('commerce_id', ticket.commerce_id)
      .eq('statut', 'EN_ATTENTE')
      .lt('numero_ordre', ticket.numero_ordre)
      .gte('cree_a', `${today}T00:00:00`);

    const { count: total } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('commerce_id', ticket.commerce_id)
      .eq('statut', 'EN_ATTENTE')
      .gte('cree_a', `${today}T00:00:00`);

    ticketsAvant = avant ?? 0;
    totalEnAttente = total ?? 0;
  }

  async function activerNotifications() {
    const sub = await abonnerPushNotifications();
    if (sub) {
      await sauvegarderPushSub(ticketId, sub);
      notifActives = true;
    }
  }
</script>

<svelte:head>
  <title>Q-Smart — Votre ticket #{ticket?.numero_ordre ?? '…'}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
</svelte:head>

<main class="client">
  {#if loading}
    <div class="loader-wrap">
      <div class="loader" aria-label="Chargement"></div>
    </div>

  {:else if !ticket}
    <div class="card error-card">
      <div class="error-icon">⚠</div>
      <h2>Ticket introuvable</h2>
      <p>Ce ticket n'existe pas ou a expiré.</p>
    </div>

  {:else}
    <!-- Header -->
    <div class="client-header">
      <div class="client-brand">Q — SMART</div>
      <div class="client-commerce">{commerce?.nom ?? ''}</div>
    </div>

    <!-- Alerte prioritaire -->
    {#if alerteNiveau === 'appele'}
      <div class="alert alert-green animate-slide-up" role="alert" aria-live="assertive">
        <span class="alert-icon animate-pulse-slow">🔔</span>
        <div>
          <strong>C'est votre tour !</strong>
          <p>Présentez-vous au comptoir maintenant.</p>
        </div>
      </div>
    {:else if alerteNiveau === 'suivant'}
      <div class="alert alert-amber animate-slide-up" role="alert" aria-live="polite">
        <span class="alert-icon">⚡</span>
        <div>
          <strong>Préparez-vous !</strong>
          <p>Vous êtes le prochain à passer.</p>
        </div>
      </div>
    {:else if alerteNiveau === 'proche'}
      <div class="alert alert-amber animate-slide-up" role="alert" aria-live="polite">
        <span class="alert-icon">⏱</span>
        <div>
          <strong>Bientôt votre tour</strong>
          <p>{ticketsAvant} personne{ticketsAvant > 1 ? 's' : ''} avant vous.</p>
        </div>
      </div>
    {/if}

    <!-- Carte ticket principale -->
    <div class="card ticket-card">
      <div class="ticket-label">Votre numéro</div>
      <div class="ticket-num">#{ticket.numero_ordre}</div>

      <div class="divider"></div>

      <div class="ticket-stats">
        <div class="tstat">
          <div class="tstat-val">
            {commerce?.dernier_ticket_appele > 0 ? `#${commerce.dernier_ticket_appele}` : '—'}
          </div>
          <div class="tstat-label">En cours</div>
        </div>
        <div class="tstat">
          <div
            class="tstat-val"
            class:accent={ticketsAvant <= 2}
            class:warn-col={ticketsAvant <= 5 && ticketsAvant > 2}
          >
            {ticketsAvant}
          </div>
          <div class="tstat-label">Avant vous</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Barre de progression -->
      <div class="progress-track">
        <div class="progress-bar" style="width: {progression}%"></div>
      </div>
      <div class="progress-label">
        ~{tempsEstime} min d'attente estimées
      </div>
    </div>

    <!-- Notifications -->
    <button
      class="notif-btn"
      class:notif-active={notifActives}
      on:click={activerNotifications}
      disabled={notifActives}
    >
      {notifActives ? '🔔 Notifications activées' : '🔕 Activer les notifications push'}
    </button>

    <p class="notif-hint">
      Soyez alerté(e) à 3 personnes de passer, puis à 1, puis quand c'est votre tour.
    </p>

    <!-- Statut de la file -->
    {#if commerce?.statut_file === 'PAUSE'}
      <div class="card status-card warn-card">
        <strong>⏸ File momentanément suspendue</strong>
        <p>Le gérant a mis la file en pause. Reprise bientôt.</p>
      </div>
    {/if}
  {/if}
</main>

<style>
  .client {
    max-width: 400px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loader-wrap { display: flex; justify-content: center; padding: 4rem; }
  .loader {
    width: 36px; height: 36px;
    border: 3px solid var(--border); border-top-color: var(--accent);
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Header */
  .client-header { text-align: center; padding: 0.5rem 0; }
  .client-brand { font-family: var(--mono); font-size: 12px; letter-spacing: 4px; color: var(--accent); margin-bottom: 2px; }
  .client-commerce { font-size: 14px; color: var(--muted); }

  /* Alerts */
  .alert {
    border-radius: 12px; padding: 1rem 1.25rem;
    display: flex; align-items: flex-start; gap: 12px;
  }
  .alert-green { background: var(--accent-bg); border: 1px solid var(--accent-border); }
  .alert-amber { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); }
  .alert-icon { font-size: 1.4rem; flex-shrink: 0; }
  .alert strong { display: block; font-size: 14px; font-weight: 600; margin-bottom: 2px; }
  .alert p { font-size: 13px; color: var(--muted); margin: 0; }

  /* Cards */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 2rem 1.5rem;
  }
  .ticket-card { text-align: center; }
  .ticket-label { font-size: 11px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .ticket-num { font-family: var(--mono); font-size: 5rem; font-weight: 700; color: var(--accent); line-height: 1; }

  .divider { height: 1px; background: var(--border); margin: 1.5rem 0; }

  /* Ticket stats */
  .ticket-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .tstat { text-align: center; }
  .tstat-val { font-family: var(--mono); font-size: 2rem; font-weight: 700; }
  .tstat-val.accent { color: var(--accent); }
  .tstat-val.warn-col { color: var(--warn); }
  .tstat-label { font-size: 12px; color: var(--muted); margin-top: 2px; }

  /* Progress */
  .progress-track { height: 6px; background: var(--surface2); border-radius: 100px; overflow: hidden; margin-bottom: 6px; }
  .progress-bar { height: 100%; background: var(--accent); border-radius: 100px; transition: width 1s ease; }
  .progress-label { font-size: 12px; color: var(--muted); text-align: right; }

  /* Notif button */
  .notif-btn {
    width: 100%; padding: 13px;
    border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface2); color: var(--muted);
    font-family: var(--sans); font-size: 14px;
    cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .notif-btn:hover:not(:disabled) { border-color: var(--accent-border); color: var(--accent); }
  .notif-btn.notif-active { border-color: var(--accent-border); color: var(--accent); background: var(--accent-bg); }
  .notif-btn:disabled { opacity: 0.7; cursor: default; }

  .notif-hint { font-size: 12px; color: var(--muted); text-align: center; line-height: 1.6; }

  /* Status card */
  .status-card { border-radius: 12px; padding: 1rem 1.25rem; }
  .warn-card { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.3); }
  .warn-card strong { display: block; font-size: 14px; margin-bottom: 4px; }
  .warn-card p { font-size: 13px; color: var(--muted); margin: 0; }

  .error-card { text-align: center; }
  .error-icon { font-size: 2rem; margin-bottom: 0.75rem; }
  .error-card h2 { font-size: 1.2rem; margin-bottom: 6px; }
  .error-card p { color: var(--muted); font-size: 14px; }
</style>
