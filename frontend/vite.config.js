import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: "/juls4634/", // INSTRUCTOR RULE: base: "/yourusername/"
  plugins: [react(), tailwindcss()],

  // ── Development server ──────────────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",  // dev: local backend
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },

  // ── Production preview (used inside Docker container) ───────────────────────
  preview: {
    port: 3000,
    host: true,   // listen on 0.0.0.0 so Docker can forward the port
    proxy: {
      "/api": {
        target: "http://backend:5000",  // Docker service name → backend container
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },

  optimizeDeps: {
    include: ['react-pdf', 'pdfjs-dist'],
  },
  resolve: {
    alias: {
      // Ensure CSS imports from react-pdf resolve correctly
    },
  },
})

