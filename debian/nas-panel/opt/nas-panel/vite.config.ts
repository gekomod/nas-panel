import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { createServer } from 'vite'
import express from 'express'
import os from 'os-utils'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import CompressionPlugin from 'compression-webpack-plugin'

export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    watch: {
      usePolling: true, // Wymagane dla niektórych środowisk
    },
    fs: {
      strict: true // Pozwala na dostęp do node_modules
    },
    headers: {
      // Tylko dla HTTPS/localhost:
      ...(process.env.NODE_ENV === 'production' || process.env.HTTPS
        ? {
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin"
          }
        : {}),
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
      // Inne przydatne nagłówki:
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',  // Zamiast _nuxt
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 3600,
    rollupOptions: {
      output: {
        entryFileNames: `assets/js/[name]-naspanel.js`,
        chunkFileNames: `assets/js/[name]-naspanel.js`,
        assetFileNames: (assetInfo) => {
          return 'assets/css/[name]-naspanel[extname]';
        }
      }
    },
  },
  optimizeDeps: {
    exclude: ['monaco-editor']
  },
  configureWebpack: {
    output: {
      filename: "assets/[name].js",
      chunkFilename: "assets/[name].js"
    }
  },
  chainWebpack(config) {
    config.plugins.delete('prefetch');
    config.plugin('CompressionPlugin').use(CompressionPlugin);
  }
})
