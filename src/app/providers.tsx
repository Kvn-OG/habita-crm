import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { AuthProvider } from '@/auth/AuthContext'
import { ToastProvider } from '@/components/feedback/Toast'
import { isAuthError } from '@/lib/errors'
import { notifySessionExpired } from '@/lib/session'

/** Sessão rejeitada pelo servidor em qualquer consulta/mutação → encerra e volta ao login. */
function handleError(error: unknown) {
  if (isAuthError(error)) notifySessionExpired()
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
    },
    mutations: { retry: false },
  },
})

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
