import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { router } from '@/lib/router'
import { ToastProvider } from '@/components/ui'
import './index.css'

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] p-4">
          <div className="w-full max-w-sm text-center">
            <div className="h-12 w-12 rounded-xl bg-[#1a2236] border border-[#1e2d45] flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold">SB</span>
            </div>
            <h1 className="text-lg font-semibold text-[#f1f5f9] mb-2">Erro ao carregar o aplicativo</h1>
            <p className="text-sm text-[#94a3b8] mb-1">{this.state.error.message}</p>
            <p className="text-xs text-[#475569]">Verifique as variáveis de ambiente e recarregue a página.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
          <ReactQueryDevtools initialIsOpen={false} />
        </ToastProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>
)
