/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#07050f',
          card: 'rgba(15, 11, 28, 0.55)',
          cyan: '#00f0ff',
          purple: '#bd00ff',
          pink: '#ff007a',
          text: '#e2e8f0',
          muted: '#94a3b8'
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 240, 255, 0.4), inset 0 0 10px rgba(0, 240, 255, 0.1)',
        'neon-purple': '0 0 15px rgba(189, 0, 255, 0.4), inset 0 0 10px rgba(189, 0, 255, 0.1)',
        'neon-pink': '0 0 15px rgba(255, 0, 122, 0.4), inset 0 0 10px rgba(255, 0, 122, 0.1)'
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
