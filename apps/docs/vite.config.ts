import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
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
