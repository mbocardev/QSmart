<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  let email = '';
  let password = '';
  let loading = false;
  let erreur = '';
  let mode: 'connexion' | 'inscription' = 'connexion';

  async function soumettre() {
  loading = true;
  erreur = '';

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, mode })
  });

  const data = await res.json();

  if (!res.ok) {
    erreur = data.error;
  } else {
    goto('/dashboard');
  }
  loading = false;
}
</script>

<svelte:head>
  <title>Q-Smart — Connexion</title>
</svelte:head>

<main class="landing">
  <!-- Grille décorative -->
  <div class="grid-bg" aria-hidden="true"></div>

  <div class="landing-content">
    <div class="brand">Q<span>—</span>SMART</div>
    <h1>
      Zéro bousculade.<br />
      <strong>Zéro friction.</strong>
    </h1>
    <p class="tagline">
      File d'attente virtuelle pour commerces dakarois.<br />
      Un QR code. Un ticket. Une notification.
    </p>

    <!-- Formulaire Auth -->
    <div class="auth-card">
      <div class="auth-tabs">
        <button
          class:active={mode === 'connexion'}
          on:click={() => { mode = 'connexion'; erreur = ''; }}
        >
          Connexion
        </button>
        <button
          class:active={mode === 'inscription'}
          on:click={() => { mode = 'inscription'; erreur = ''; }}
        >
          Créer un compte
        </button>
      </div>

      <div class="auth-fields">
        <input
          type="email"
          placeholder="Adresse e-mail"
          bind:value={email}
          on:keydown={(e) => e.key === 'Enter' && soumettre()}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          bind:value={password}
          on:keydown={(e) => e.key === 'Enter' && soumettre()}
        />
        {#if erreur}
          <p class="auth-error">{erreur}</p>
        {/if}
        <button class="btn-primary" on:click={soumettre} disabled={loading}>
          {loading ? 'Chargement…' : mode === 'connexion' ? 'Accéder au dashboard →' : 'Créer mon espace gérant →'}
        </button>
      </div>
    </div>

    <!-- Feature cards -->
    <div class="features">
      {#each [
        { icon: '📱', title: 'Interface Client', desc: 'Scan du QR, ticket instantané, suivi en temps réel. Zéro téléchargement.' },
        { icon: '🖥️', title: 'Kiosque d\'entrée', desc: 'QR code dynamique anti-triche. Se renouvelle toutes les 15 secondes.' },
        { icon: '⚡', title: 'Dashboard Gérant', desc: 'Appel du suivant, rappels, gestion de la file. Optimisé pour le rush.' }
      ] as f}
        <div class="feature-card">
          <span class="feature-icon">{f.icon}</span>
          <h3>{f.title}</h3>
          <p>{f.desc}</p>
        </div>
      {/each}
    </div>
  </div>
</main>

<style>
  .landing {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    position: relative;
    overflow: hidden;
  }

  .grid-bg {
    position: absolute;
    inset: 0;
    opacity: 0.03;
    background-image:
      linear-gradient(var(--accent) 1px, transparent 1px),
      linear-gradient(90deg, var(--accent) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }

  .landing-content {
    max-width: 640px;
    width: 100%;
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .brand {
    font-family: var(--mono);
    font-size: 1rem;
    letter-spacing: 4px;
    color: var(--accent);
    margin-bottom: 2rem;
  }
  .brand span { color: var(--muted); }

  h1 {
    font-size: clamp(2.2rem, 6vw, 4rem);
    font-weight: 300;
    letter-spacing: -2px;
    margin-bottom: 1rem;
    line-height: 1.1;
  }
  h1 strong { font-weight: 700; color: var(--accent); }

  .tagline {
    color: var(--muted);
    font-size: 1.05rem;
    line-height: 1.7;
    margin-bottom: 2.5rem;
  }

  /* Auth */
  .auth-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    text-align: left;
  }

  .auth-tabs {
    display: flex;
    gap: 4px;
    background: var(--surface2);
    border-radius: 8px;
    padding: 4px;
    margin-bottom: 1.25rem;
  }
  .auth-tabs button {
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-family: var(--sans);
    font-size: 14px;
    cursor: pointer;
    transition: all .2s;
  }
  .auth-tabs button.active {
    background: var(--accent);
    color: #000;
    font-weight: 600;
  }

  .auth-fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  input {
    width: 100%;
    padding: 12px 14px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    outline: none;
    transition: border-color .2s;
  }
  input:focus { border-color: var(--accent-border); }
  input::placeholder { color: var(--muted); }

  .auth-error {
    font-size: 13px;
    color: var(--danger);
    padding: 8px 12px;
    background: rgba(239,68,68,0.08);
    border-radius: 6px;
    border: 1px solid rgba(239,68,68,0.2);
  }

  .btn-primary {
    width: 100%;
    padding: 13px;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s;
  }
  .btn-primary:hover:not(:disabled) { background: var(--accent-dim); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Features */
  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    text-align: left;
  }

  .feature-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem;
    transition: border-color .2s;
  }
  .feature-card:hover { border-color: var(--accent-border); }

  .feature-icon { font-size: 1.4rem; display: block; margin-bottom: 0.75rem; }
  .feature-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  .feature-card p { font-size: 12px; color: var(--muted); line-height: 1.6; }

  @media (max-width: 600px) {
    .features { grid-template-columns: 1fr; }
    h1 { font-size: 2rem; }
  }
</style>
