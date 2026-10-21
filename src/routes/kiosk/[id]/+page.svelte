<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { initQueue, cleanupQueue, commerce, ticketsEnAttente } from '$lib/stores/queue';
  import { pourcentageRestant } from '$lib/utils/token';
  import QRCode from 'qrcode';

  const commerceId = $page.params.id;

  let qrDataUrl = '';
  let progress = 100;
  let intervalQr: ReturnType<typeof setInterval>;
  let intervalProgress: ReturnType<typeof setInterval>;

  onMount(async () => {
    await initQueue(commerceId);
    await genererQR();

    // Renouveler le QR toutes les 5 secondes
    intervalQr = setInterval(genererQR, 5000);

    // Barre de progression fluide (100ms)
    intervalProgress = setInterval(() => {
      progress = pourcentageRestant();
    }, 100);
  });

  onDestroy(() => {
    clearInterval(intervalQr);
    clearInterval(intervalProgress);
    cleanupQueue();
  });

  async function genererQR() {
    try {
      // Appel API serveur — génère le token côté Node.js (Buffer disponible)
      const res = await fetch(`/api/qr/${commerceId}`);
      if (!res.ok) {
        console.error('Erreur API QR:', res.status, await res.text());
        return;
      }
      const { token } = await res.json();
      const url = `${window.location.origin}/queue/scan?t=${encodeURIComponent(token)}`;
      qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      });
    } catch (e) {
      console.error('Erreur génération QR:', e);
    }
  }
</script>

<svelte:head>
  <title>Q-Smart Kiosk — {$commerce?.nom ?? ''}</title>
</svelte:head>

<main class="kiosk">
  {#if $commerce?.statut_file === 'FERMEE'}
    <!-- File fermée -->
    <div class="kiosk-inner">
      <div class="brand">Q — SMART</div>
      <div class="closed-card">
        <div class="closed-icon">🔴</div>
        <h2>Inscriptions fermées</h2>
        <p>La file est fermée pour aujourd'hui.<br/>Merci de votre visite.</p>
      </div>
    </div>

  {:else if $commerce?.statut_file === 'PAUSE'}
    <!-- Pause -->
    <div class="kiosk-inner">
      <div class="brand">Q — SMART</div>
      <div class="closed-card">
        <div class="closed-icon">⏸</div>
        <h2>File momentanément suspendue</h2>
        <p>Nous reprenons très bientôt.<br/>Merci pour votre patience.</p>
      </div>
    </div>

  {:else}
    <!-- File ouverte — affichage QR -->
    <div class="kiosk-inner">
      <div class="brand">Q — SMART · {$commerce?.nom ?? ''}</div>

      <div class="qr-wrapper">
        {#if qrDataUrl}
          <img src={qrDataUrl} alt="QR Code pour prendre un ticket" class="qr-img" />
        {:else}
          <div class="qr-placeholder">Chargement…</div>
        {/if}

        <!-- Barre de progression anti-triche -->
        <div class="progress-track">
          <div class="progress-bar" style="width: {progress}%"></div>
        </div>
        <div class="progress-label">Code sécurisé — se renouvelle automatiquement</div>
      </div>

      <p class="scan-cta">Scannez avec votre téléphone pour prendre un ticket</p>
      <p class="scan-sub">Pas d'application à télécharger · Ouverture instantanée</p>

      <!-- Stats -->
      <div class="kiosk-stats">
        <div class="kiosk-stat">
          <div class="stat-val">
            {$commerce?.dernier_ticket_appele > 0 ? `#${$commerce.dernier_ticket_appele}` : '—'}
          </div>
          <div class="stat-label">En cours</div>
        </div>
        <div class="kiosk-stat">
          <div class="stat-val">{$ticketsEnAttente.length}</div>
          <div class="stat-label">Personnes avant vous</div>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  .kiosk {
    min-height: 100vh;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .kiosk-inner {
    max-width: 520px;
    width: 100%;
    text-align: center;
  }

  .brand {
    font-family: var(--mono);
    font-size: 13px;
    letter-spacing: 4px;
    color: var(--accent);
    opacity: 0.7;
    margin-bottom: 3rem;
  }

  /* QR */
  .qr-wrapper {
    background: white;
    border-radius: 20px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0 auto 2rem auto;
    width: 320px;
  }

  .qr-img { display: block; width: 260px; height: 260px; }
  .qr-placeholder {
    width: 260px; height: 260px; background: #f0f0f0;
    display: flex; align-items: center; justify-content: center;
    color: #999; font-size: 14px; border-radius: 8px;
  }

  .progress-track {
    height: 4px; background: #e0e0e0; border-radius: 100px;
    margin-top: 1rem; overflow: hidden;
  }
  .progress-bar {
    height: 100%; background: var(--accent); border-radius: 100px;
    transition: width 0.1s linear;
  }
  .progress-label {
    font-size: 10px; color: #999; margin-top: 6px;
    font-family: var(--mono); letter-spacing: 1px;
  }

  .scan-cta { font-size: 1.2rem; font-weight: 500; margin-bottom: 6px; }
  .scan-sub { font-size: 13px; color: var(--muted); margin-bottom: 3rem; }

  /* Stats */
  .kiosk-stats {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
  }
  .kiosk-stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 2rem 1.5rem;
  }
  .stat-val {
    font-family: var(--mono); font-size: 3.5rem; font-weight: 700;
    color: var(--accent); line-height: 1;
  }
  .stat-label {
    font-size: 12px; color: var(--muted); margin-top: 6px;
    text-transform: uppercase; letter-spacing: 1px;
  }

  /* Closed */
  .closed-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 3rem;
  }
  .closed-icon { font-size: 3rem; margin-bottom: 1rem; }
  .closed-card h2 { font-size: 1.5rem; margin-bottom: 10px; }
  .closed-card p { color: var(--muted); line-height: 1.7; font-size: 15px; }
</style>
