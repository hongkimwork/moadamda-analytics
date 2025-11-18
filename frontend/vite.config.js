import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      port: 3030,
      host: '0.0.0.0',
      // API 프록시 설정: /api 요청을 백엔드로 전달
      proxy: {
        '/api': {
          target: 'http://localhost:3003',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      // 청크 크기 경고 한도 상향 (기본 500KB → 1000KB)
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // 큰 라이브러리를 별도 청크로 분리하여 캐싱 최적화
          manualChunks: {
            // React 관련 라이브러리
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // UI 라이브러리
            'antd-vendor': ['antd'],
            // 차트 라이브러리
            'charts-vendor': ['recharts', 'reactflow'],
            // Radix UI 컴포넌트
            'radix-vendor': [
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs'
            ]
          }
        }
      }
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || ''
      )
    }
  }
})

