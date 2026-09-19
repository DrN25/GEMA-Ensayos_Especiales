import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno del frontend si existen
  const env = loadEnv(mode, process.cwd(), '')

  // Para el sistema actual (Ensayos Especiales / SIGEG), el backend corre en el puerto 8002
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8002'

  return {
    plugins: [react()],
    server: {
      port: 5175, // El puerto local donde corre tu Frontend de Ensayos Especiales
      strictPort: true,
      host: '127.0.0.1',
      proxy: {
        // Redirige de forma transparente cualquier petición de /api a tu backend de FastAPI en el puerto 8002
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
      allowedHosts: true, // Crucial para permitir que el túnel de Cloudflare acceda sin bloqueos
    },
  }
})