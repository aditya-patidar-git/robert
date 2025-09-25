import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    allowedHosts: [
      'vscode-35d7126e-2b8c-439a-99d2-90b815ada1da.preview.emergentagent.com'
    ]
  },
  build: {
    outDir: 'build'
  }
})

