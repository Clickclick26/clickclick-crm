import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset base so one build works unmodified at both the custom
  // domain (crm.clickclick.video, served from /) and the GitHub Pages
  // project URL (clickclick26.github.io/clickclick-crm/, served from a
  // subpath) — no more juggling two different base paths per deploy target.
  base: './',
})
