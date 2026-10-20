import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { SetupRequiredPage } from '@/auth/SetupRequiredPage'
import { isSupabaseConfigured } from '@/lib/supabase'
import '@/lib/validations'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado.')

// Sem credenciais do Supabase, a aplicação não simula dados: exibe as instruções de configuração.
if (isSupabaseConfigured) {
  const { router } = await import('@/app/router')
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <SetupRequiredPage />
    </StrictMode>,
  )
}
