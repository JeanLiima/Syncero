import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:          resolve(__dirname, 'index.html'),
        flowExternal:  resolve(__dirname, 'flow-external.html'),
        booksExternal: resolve(__dirname, 'books-external.html'),
        flow:          resolve(__dirname, 'flow.html'),
        books:         resolve(__dirname, 'books.html'),
      },
    },
  },
})
