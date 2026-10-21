<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase, type Commerce } from '$lib/supabase';
  import {
    initQueue, cleanupQueue,
    commerce, tickets, ticketsEnAttente, ticketAppele, ticketsTraites, tempsAttenteEstime,
    appelerSuivant, marquerAbsent, ajouterTicketManuel,
    changerStatutFile, reinitialiserFile
  } from '$lib/stores/queue';
  import { goto } from '$app/navigation';

  // ── État local ───────────────────────────────────────────────
  let mesCommerces: Commerce[] = [];
  let commerceSelectionne: string | null = null;
  let toast: { msg: string; type: string } | null = null;
  let recalling = false;
  let confirmReset = false;

  // ── Auth + chargement des commerces ─────────────────────────
  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { goto('/'); return; }

    const { data } = await supabase
      .from('commerces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at');

    mesCommerces = data ?? [];

    // Auto-sélection si un seul commerce
    if (mesCommerces.length === 1) {
      selectionner(mesCommerces[0].id);
    }
  });

  onDestroy(() => cleanupQueue());

  // ── Actions ──────────────────────────────────────────────────
  async function selectionner(id: string) {
    commerceSelectionne = id;
    await initQueue(id);
  }

  function afficherToast(msg: string, type = 'success') {
    toast = { msg, type };
    setTimeout(() => (toast = null), 3000);
  }

  async function handleAppelerSuivant() {
    const res = await appelerSuivant(commerceSelectionne!);
    if (res.erreur?.includes('FILE_VIDE')) {
      afficherToast('Aucun client en attente.', 'warn');
    } else if (res.erreur) {
      afficherToast(res.erreur, 'error');
    } else {
      afficherToast(`N°${$ticketsEnAttente[0]?.numero_ordre ?? ''} appelé !`);
    }
  }

  async function handleMarquerAbsent() {
    if (!$ticketAppele) return;
    await marquerAbsent($ticketAppele.id);
    afficherToast(`N°${$ticketAppele.numero_ordre} marqué absent.`, 'error');
  }

  async function handleRappeler() {
    recalling = true;
    afficherToast(`Rappel envoyé pour N°${$commerce?.dernier_ticket_appele}`, 'warn');
    // Ici : appel à /api/push/notify avec le numéro actuel
    await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commerceId: commerceSelectionne,
        numeroAppele: $commerce?.dernier_ticket_appele
      })
    });
    setTimeout(() => (recalling = false), 2000);
  }

  async function handleAjouterManuel() {
    const nom = prompt('Nom du client (optionnel) :') ?? undefined;
    const res = await ajouterTicketManuel(commerceSelectionne!, nom || 'Ticket physique');
    if (res.ticket) {
      afficherToast(`Ticket N°${res.ticket.numero_ordre} ajouté.`);
    }
  }

  async function handleStatut(s: 'OUVERTE' | 'PAUSE' | 'FERMEE') {
    await changerStatutFile(commerceSelectionne!, s);
    const labels = { OUVERTE: 'File ouverte ✓', PAUSE: 'File en pause', FERMEE: 'Inscriptions fermées' };
    const types = { OUVERTE: 'success', PAUSE: 'warn', FERMEE: 'error' };
    afficherToast(labels[s], types[s]);
  }

  async function handleReset() {
    if (!confirmReset) { confirmReset = true; return; }
    await reinitialiserFile(commerceSelectionne!);
    afficherToast('File réinitialisée. Compteur remis à 0.', 'warn');
    confirmReset = false;
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    goto('/');
  }

  // ── Utilitaires ──────────────────────────────────────────────
  function timeAgo(d: string) {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return "À l'instant";
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h`;
  }

  const statusClass: Record<string, string> = {
    OUVERTE: 'pill-open',
    PAUSE: 'pill-pause',
    FERMEE: 'pill-closed'
  };
  const statusLabel: Record<string, string> = {
    OUVERTE: 'OUVERTE',
    PAUSE: 'EN PAUSE',
    FERMEE: 'FERMÉE'
  };
</script>

<svelte:head>
  <title>Q-Smart — Dashboard</title>
</svelte:head>

<!-- Toast -->
{#if toast}
  <div class="toast toast-{toast.type}" role="alert" aria-live="polite">
    {toast.msg}
  </div>
{/if}

<div class="app">
  <!-- Navbar -->
  <nav class="navbar">
    <div class="nav-brand">Q<span>—</span>SMART</div>
    <div class="nav-right">
      {#if commerceSelectionne}
        <a href="/kiosk/{commerceSelectionne}" target="_blank" class="nav-link">
          Ouvrir le kiosque ↗
        </a>
      {/if}
      <button class="btn-ghost" on:click={deconnexion}>Déconnexion</button>
    </div>
  </nav>

  <!-- Sélection du commerce -->
  {#if !commerceSelectionne}
    <section class="selector">
      <h2>Choisir un commerce</h2>
      <div class="commerce-grid">
        {#each mesCommerces as c}
          <button class="commerce-card" on:click={() => selectionner(c.id)}>
            <div class="commerce-name">{c.nom}</div>
            <div class="commerce-meta">N°{c.dernier_ticket_appele} en cours</div>
            <span class="pill {statusClass[c.statut_file]}">{statusLabel[c.statut_file]}</span>
          </button>
        {/each}

        {#if mesCommerces.length === 0}
          <div class="empty-state">
            <p>Aucun commerce configuré.</p>
            <p class="muted">Créez votre premier commerce dans les paramètres.</p>
          </div>
        {/if}
      </div>
    </section>

  {:else if $commerce}
    <!-- Dashboard principal -->
    <div class="dashboard">
      <!-- En-tête -->
      <div class="dash-header">
        <div>
          <button class="btn-back" on:click={() => { commerceSelectionne = null; cleanupQueue(); }}>
            ← Tous les commerces
          </button>
          <h1 class="dash-title">{$commerce.nom}</h1>
          <p class="dash-sub">Dashboard gérant · Temps réel</p>
        </div>
        <span class="pill {statusClass[$commerce.statut_file]}">
          <span class="dot {$commerce.statut_file === 'PAUSE' ? 'dot-warn' : $commerce.statut_file === 'FERMEE' ? 'dot-off' : ''}"></span>
          {statusLabel[$commerce.statut_file]}
        </span>
      </div>

      <!-- Métriques -->
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">En attente</div>
          <div class="metric-value" class:warn={$ticketsEnAttente.length > 5}>
            {$ticketsEnAttente.length}
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">En cours</div>
          <div class="metric-value accent">
            {$commerce.dernier_ticket_appele > 0 ? `#${$commerce.dernier_ticket_appele}` : '—'}
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">Traités</div>
          <div class="metric-value">{$ticketsTraites.length}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Attente estimée</div>
          <div class="metric-value">
            {$tempsAttenteEstime > 0 ? `${Math.round($tempsAttenteEstime)} min` : '—'}
          </div>
        </div>
      </div>

      <!-- Grille principale -->
      <div class="main-grid">
        <!-- Panneau de contrôle -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Contrôle de la file</span>
          </div>
          <div class="control-center">
            <div class="serving-label">En cours de service</div>
            <div
              class="serving-number"
              class:animate-blink={recalling}
            >
              {$commerce.dernier_ticket_appele > 0 ? `#${$commerce.dernier_ticket_appele}` : '—'}
            </div>
            <div class="serving-name">
              {$ticketAppele?.nom_client ?? 'Aucun client en cours'}
            </div>

            <div class="action-grid">
              <button
                class="action-btn primary"
                on:click={handleAppelerSuivant}
              >
                ▶ Appeler le suivant
                {#if $ticketsEnAttente.length > 0}
                  <span class="count-badge">{$ticketsEnAttente.length}</span>
                {/if}
              </button>
              <button
                class="action-btn warn"
                on:click={handleRappeler}
                disabled={!$ticketAppele}
              >
                🔔 Rappeler
              </button>
              <button
                class="action-btn danger"
                on:click={handleMarquerAbsent}
                disabled={!$ticketAppele}
              >
                ✗ Marquer absent
              </button>
              <button class="action-btn" on:click={handleAjouterManuel}>
                + Ticket physique
              </button>
            </div>
          </div>
        </div>

        <!-- Panneau droit : file + config -->
        <div class="right-col">
          <!-- Liste des tickets -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">File d'attente</span>
              <span class="panel-count">{$ticketsEnAttente.length} pers.</span>
            </div>
            <ul class="ticket-list">
              {#each [...$tickets].filter(t => t.statut !== 'TRAITE').slice(0, 10) as t (t.id)}
                <li class="ticket-item">
                  <span class="t-num" class:t-num-active={t.statut === 'APPELE'}>
                    #{t.numero_ordre}
                  </span>
                  <div class="t-info">
                    <div class="t-name">{t.nom_client ?? 'Client'}</div>
                    <div class="t-time">{timeAgo(t.cree_a)}</div>
                  </div>
                  <span class="t-badge badge-{t.statut.toLowerCase()}">
                    {t.statut === 'APPELE' ? 'EN COURS' : t.statut === 'ABSENT' ? 'ABSENT' : 'ATTEND'}
                  </span>
                </li>
              {:else}
                <li class="ticket-empty">File vide</li>
              {/each}
            </ul>
            <div class="add-manual">
              <button on:click={handleAjouterManuel}>+ Ajouter manuellement</button>
            </div>
          </div>

          <!-- Configuration -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">Configuration</span>
            </div>
            <div class="config-body">
              <p class="config-section-title">Statut de la file</p>
              <button class="config-btn" on:click={() => handleStatut('OUVERTE')}>
                🟢 Ouvrir les inscriptions
              </button>
              <button class="config-btn" on:click={() => handleStatut('PAUSE')}>
                ⏸ Mettre en pause
              </button>
              <button class="config-btn" on:click={() => handleStatut('FERMEE')}>
                🔴 Fermer les inscriptions
              </button>

              <p class="config-section-title" style="margin-top: 1rem;">Fin de journée</p>
              <button
                class="config-btn danger"
                on:click={handleReset}
              >
                {confirmReset ? '⚠ Confirmer la réinitialisation ?' : '↺ Réinitialiser la file'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .app { min-height: 100vh; }

  /* Navbar */
  .navbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    position: sticky; top: 0; z-index: 50;
  }
  .nav-brand { font-family: var(--mono); font-size: 1rem; letter-spacing: 3px; color: var(--accent); }
  .nav-brand span { color: var(--muted); }
  .nav-right { display: flex; align-items: center; gap: 12px; }
  .nav-link { font-size: 13px; color: var(--muted); transition: color .2s; }
  .nav-link:hover { color: var(--accent); }
  .btn-ghost {
    background: none; border: 1px solid var(--border); color: var(--muted);
    padding: 6px 14px; border-radius: 6px; font-family: var(--sans); font-size: 13px;
    cursor: pointer; transition: all .15s;
  }
  .btn-ghost:hover { color: var(--text); border-color: #444; }

  /* Selector */
  .selector { padding: 2rem; max-width: 900px; margin: 0 auto; }
  .selector h2 { font-size: 1.2rem; font-weight: 600; margin-bottom: 1.5rem; }
  .commerce-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
  .commerce-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 1.5rem; cursor: pointer; text-align: left;
    font-family: var(--sans); color: var(--text); transition: all .15s;
  }
  .commerce-card:hover { border-color: var(--accent-border); transform: translateY(-2px); }
  .commerce-name { font-weight: 600; margin-bottom: 4px; }
  .commerce-meta { font-size: 12px; color: var(--muted); margin-bottom: 10px; }
  .empty-state { text-align: center; padding: 3rem; color: var(--muted); }

  /* Dashboard */
  .dashboard { padding: 1.5rem 2rem; max-width: 1100px; margin: 0 auto; }
  .dash-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
  .btn-back { background: none; border: none; color: var(--muted); font-size: 13px; cursor: pointer; font-family: var(--sans); padding: 0; margin-bottom: 4px; display: block; }
  .dash-title { font-size: 1.4rem; font-weight: 600; margin-bottom: 2px; }
  .dash-sub { font-size: 13px; color: var(--muted); }

  /* Pills */
  .pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px; padding: 4px 12px; border-radius: 100px; font-weight: 700; letter-spacing: 1px; }
  .pill-open { background: rgba(0,232,122,0.1); color: var(--accent); border: 1px solid var(--accent-border); }
  .pill-pause { background: rgba(245,158,11,0.1); color: var(--warn); border: 1px solid rgba(245,158,11,0.2); }
  .pill-closed { background: rgba(239,68,68,0.1); color: var(--danger); border: 1px solid rgba(239,68,68,0.2); }

  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 1.5s infinite; }
  .dot-warn { background: var(--warn); }
  .dot-off { background: var(--muted); animation: none; }

  /* Metrics */
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
  .metric { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }
  .metric-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .metric-value { font-family: var(--mono); font-size: 2rem; font-weight: 700; }
  .metric-value.accent { color: var(--accent); }
  .metric-value.warn { color: var(--warn); }

  /* Main grid */
  .main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; }
  .right-col { display: flex; flex-direction: column; gap: 1rem; }

  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .panel-header { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .panel-title { font-size: 14px; font-weight: 600; }
  .panel-count { font-size: 12px; color: var(--muted); }

  /* Control center */
  .control-center { padding: 2rem; text-align: center; }
  .serving-label { font-size: 11px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .serving-number { font-family: var(--mono); font-size: 5.5rem; font-weight: 700; color: var(--accent); line-height: 1; margin-bottom: 4px; }
  .serving-name { font-size: 14px; color: var(--muted); margin-bottom: 2rem; }

  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .action-btn {
    padding: 12px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--surface2); color: var(--text); font-size: 13px; font-weight: 500;
    cursor: pointer; font-family: var(--sans); transition: all .15s;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .action-btn:hover:not(:disabled) { border-color: var(--accent-border); color: var(--accent); }
  .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .action-btn.primary { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 700; grid-column: 1 / -1; padding: 16px; font-size: 15px; }
  .action-btn.primary:hover { background: var(--accent-dim); }
  .action-btn.warn { color: var(--warn); border-color: rgba(245,158,11,0.2); }
  .action-btn.warn:hover:not(:disabled) { background: rgba(245,158,11,0.08); border-color: var(--warn); color: var(--warn); }
  .action-btn.danger { color: var(--danger); border-color: rgba(239,68,68,0.2); }
  .action-btn.danger:hover:not(:disabled) { background: rgba(239,68,68,0.08); border-color: var(--danger); color: var(--danger); }
  .count-badge { background: rgba(0,0,0,0.25); border-radius: 100px; font-size: 12px; padding: 1px 8px; font-family: var(--mono); }

  /* Ticket list */
  .ticket-list { list-style: none; margin: 0; padding: 0; }
  .ticket-item { display: flex; align-items: center; gap: 12px; padding: 12px 1.25rem; border-bottom: 1px solid var(--border); transition: background .15s; }
  .ticket-item:hover { background: var(--surface2); }
  .ticket-item:last-child { border-bottom: none; }
  .t-num { font-family: var(--mono); font-size: 1.1rem; font-weight: 700; min-width: 44px; color: var(--muted); }
  .t-num-active { color: var(--accent) !important; }
  .t-info { flex: 1; }
  .t-name { font-size: 13px; font-weight: 500; }
  .t-time { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .t-badge { font-size: 10px; font-family: var(--mono); padding: 2px 8px; border-radius: 100px; font-weight: 700; }
  .badge-en_attente { background: rgba(245,158,11,0.1); color: var(--warn); border: 1px solid rgba(245,158,11,0.2); }
  .badge-appele { background: var(--accent-bg); color: var(--accent); border: 1px solid var(--accent-border); }
  .badge-absent { background: rgba(239,68,68,0.1); color: var(--danger); border: 1px solid rgba(239,68,68,0.2); }
  .ticket-empty { padding: 2rem; text-align: center; color: var(--muted); font-size: 13px; }

  .add-manual { padding: 10px 1.25rem; border-top: 1px solid var(--border); }
  .add-manual button { width: 100%; padding: 8px; border-radius: 6px; border: 1px dashed var(--border); background: transparent; color: var(--muted); font-size: 13px; cursor: pointer; font-family: var(--sans); transition: all .15s; }
  .add-manual button:hover { border-color: var(--accent-border); color: var(--accent); }

  /* Config */
  .config-body { padding: 1.25rem; }
  .config-section-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .config-btn { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: 13px; font-weight: 500; cursor: pointer; font-family: var(--sans); transition: all .15s; text-align: left; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .config-btn:hover { border-color: var(--accent-border); color: var(--accent); }
  .config-btn.danger { color: var(--danger); }
  .config-btn.danger:hover { border-color: var(--danger); background: rgba(239,68,68,0.06); }

  /* Toast */
  .toast {
    position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 999;
    background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
    padding: 12px 18px; font-size: 13px; animation: slideUp 0.2s ease;
    max-width: 280px;
  }
  .toast-success { border-color: var(--accent-border); background: var(--accent-bg); }
  .toast-warn { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }
  .toast-error { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }

  @media (max-width: 900px) {
    .main-grid { grid-template-columns: 1fr; }
    .metrics { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .dashboard { padding: 1rem; }
    .metrics { grid-template-columns: repeat(2, 1fr); }
  }
</style>
