/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        sans: ['"DM Sans"', 'sans-serif']
      },
      colors: {
        bg: '#0a0a0a',
        surface: '#141414',
        surface2: '#1c1c1c',
        border: '#2a2a2a',
        accent: '#00e87a',
        'accent-dim': '#00c96a',
        muted: '#666666',
        warn: '#f59e0b',
        danger: '#ef4444'
      }
    }
  },
  plugins: []
};
