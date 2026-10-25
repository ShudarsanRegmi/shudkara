import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

function pwaPrecachePlugin(): Plugin {
  return {
    name: 'pwa-precache-plugin',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist')
      const assetsDir = path.resolve(distDir, 'assets')
      const swDistPath = path.resolve(distDir, 'sw.js')

      if (!fs.existsSync(distDir) || !fs.existsSync(swDistPath)) {
        return
      }

      // Collect all output asset files in dist/assets
      let assetFiles: string[] = []
      if (fs.existsSync(assetsDir)) {
        assetFiles = fs.readdirSync(assetsDir).map(file => `/assets/${file}`)
      }

      const precacheList = [
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.svg',
        '/icon-192.png',
        '/icon-512.png',
        '/icons.svg',
        ...assetFiles
      ]

      const cacheVersion = `shudkara-v${Date.now()}`
      let swContent = fs.readFileSync(swDistPath, 'utf8')

      swContent = swContent
        .replace("const CACHE_VERSION = '__CACHE_VERSION__';", `const CACHE_VERSION = '${cacheVersion}';`)
        .replace('const INJECTED_ASSETS = null;', `const INJECTED_ASSETS = ${JSON.stringify(precacheList, null, 2)};`)

      fs.writeFileSync(swDistPath, swContent, 'utf8')
      console.log(`[PWA Plugin] Precache generated with ${precacheList.length} assets and version ${cacheVersion}`)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pwaPrecachePlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      }
    }
  }
})
