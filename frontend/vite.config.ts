import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * SEO tags that need an absolute URL (canonical, og:url, og:image…) are only
 * injected when VITE_SITE_URL is defined (e.g. in .env.production), so local
 * builds never ship a wrong domain.
 */
function seoAbsoluteUrls(siteUrl?: string): Plugin {
  const base = siteUrl?.replace(/\/+$/, '')
  return {
    name: 'seo-absolute-urls',
    transformIndexHtml(html) {
      if (!base) return html
      return {
        html: html.replaceAll('"/og-image.png"', `"${base}/og-image.png"`),
        tags: [
          { tag: 'link', attrs: { rel: 'canonical', href: `${base}/` }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:url', content: `${base}/` }, injectTo: 'head' },
        ],
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react(), seoAbsoluteUrls(env.VITE_SITE_URL)],

    // Server configuration
    server: {
      port: 3000,
      open: true,
      proxy: {
        // Proxy API requests to backend
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },

    // Build configuration
    build: {
      outDir: 'build',
      sourcemap: true,
      // Optimize bundle size
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'bootstrap-vendor': ['bootstrap', 'reactstrap'],
          }
        }
      }
    },

    // Path aliases (optional but recommended)
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@assets': path.resolve(__dirname, './src/assets')
      }
    },

    // Define global constants
    define: {
      // Make process.env available if needed
      'process.env': {}
    },

    // CSS configuration
    css: {
      devSourcemap: true
    }
  }
})
