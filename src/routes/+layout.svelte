<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
    rel="stylesheet"
  />
  <title>Q-Smart — File d'attente intelligente</title>
  <meta name="description" content="Gérez votre file d'attente sans application à télécharger." />
  <meta name="theme-color" content="#0a0a0a" />
  <link rel="manifest" href="/manifest.json" />
</svelte:head>

<slot />
