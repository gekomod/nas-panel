import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { createServer } from 'vite'
import express from 'express'
import os from 'os-utils'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    vue(),
    nodePolyfills({
      include: ['buffer', 'process'], // Wymagane dla sql.js
    })
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
      strict: false // Pozwala na dostęp do node_modules
    },
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  },
  optimizeDeps: {
    exclude: ['monaco-editor','@sqlite.org/sqlite-wasm']
  }
})
