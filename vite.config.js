import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev-server only: bind on all interfaces and accept the sandbox preview host.
  server: { host: true, allowedHosts: true, port: 5173, strictPort: true },
})
