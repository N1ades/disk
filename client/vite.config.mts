// Plugins
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import Fonts from 'unplugin-fonts/vite'
import { websocketProxyPlugin } from "./src/plugins/vite-plugin-ws-proxy.ts";

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const PROXY_TARGET = 'localhost:83'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify(),
    Components(),
    Fonts({
      fontsource: {
        families: [
          {
            name: 'Roboto',
            weights: [400, 500],
            styles: ['normal'],
          },
        ],
      },
    }),
    websocketProxyPlugin({
      target: `ws://${PROXY_TARGET}`, wsPathFilter: (url) => {
        return !url.includes('?token=')
      }
    })

  ],
  optimizeDeps: {
    exclude: ['vuetify'],
  },
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  preview: {
    allowedHosts: ['disk-dev.owlet.dev'],
    port: 84,
    proxy: {
      // Match all paths that contain `/someid/files/`
      '^/([^/]+)/files/.*$': {
        target: `http://${PROXY_TARGET}`,
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
  server: {
    allowedHosts: ['disk-dev.owlet.dev'],
    port: 84,
    proxy: {
      // Match all paths that contain `/someid/files/`
      '^/([^/]+)/files/.*$': {
        target: `http://${PROXY_TARGET}`,
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
  css: {
    preprocessorOptions: {
      sass: {
        api: 'modern-compiler',
      },
      scss: {
        api: 'modern-compiler',
      },
    },
  },
})
