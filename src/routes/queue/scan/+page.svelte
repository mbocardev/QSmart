<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let etat: 'chargement' | 'succes' | 'erreur' = 'chargement';
  let message = '';
  let ticketId = '';

  onMount(async () => {
    const token = $page.url.searchParams.get('t');

    if (!token) {
      etat = 'erreur';
      message = 'Lien de scan invalide. Scannez le QR code directement.';
      return;
    }

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (data.succes) {
        ticketId = data.ticket.id;
        goto(`/queue/${ticketId}`);
      } else {
        etat = 'erreur';
        message = data.message;
      }
    } catch {
      etat = 'erreur';
      message = 'Erreur réseau. Vérifiez votre connexion et réessayez.';
    }
  });
</script>

<svelte:head>
  <title>Q-Smart — Scan en cours…</title>
</svelte:head>

<main class="scan-page">
  {#if etat === 'chargement'}
    <div class="scan-card">
      <div class="loader" aria-label="Chargement"></div>
      <p class="scan-msg">Validation du QR code…</p>
      <p class="scan-sub">Quelques instants</p>
    </div>

  {:else if etat === 'erreur'}
    <div class="scan-card error">
      <div class="error-icon">⚠</div>
      <h2>Code invalide</h2>
      <p class="scan-msg">{message}</p>
      <p class="scan-hint">
        Retournez à l'entrée du commerce et scannez le QR code directement sur l'écran.
      </p>
    </div>
  {/if}
</main>

<style>
  .scan-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .scan-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3rem 2rem;
    text-align: center;
    max-width: 360px;
    width: 100%;
  }
  .scan-card.error { border-color: rgba(239,68,68,0.3); }

  .loader {
    width: 40px; height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1.5rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-icon { font-size: 2.5rem; margin-bottom: 1rem; color: var(--danger); }
  h2 { font-size: 1.3rem; margin-bottom: 0.75rem; }
  .scan-msg { color: var(--text); font-size: 15px; margin-bottom: 0.5rem; }
  .scan-sub { color: var(--muted); font-size: 13px; }
  .scan-hint { color: var(--muted); font-size: 13px; line-height: 1.6; margin-top: 1rem; }
</style>
