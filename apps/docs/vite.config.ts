import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        external: resolve(__dirname, 'external.html'),
        flow:     resolve(__dirname, 'flow.html'),
        books:    resolve(__dirname, 'books.html'),
      },
    },
  },
})
