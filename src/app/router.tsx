import { createBrowserRouter, Outlet } from 'react-router-dom'
import { ForgotPasswordPage } from '@/auth/ForgotPasswordPage'
import { LoginPage } from '@/auth/LoginPage'
import { ProtectedRoute, PublicOnlyRoute } from '@/auth/ProtectedRoute'
import { ResetPasswordPage } from '@/auth/ResetPasswordPage'
import { AppLayout } from '@/components/layout/AppLayout'
import type { RouteHandle } from './navigation'
import { NotFoundPage } from './NotFoundPage'
import { Providers } from './providers'
import { RouteError } from './RouteError'

const handle = (title: string, crumb?: string): RouteHandle => ({ title, crumb: crumb ?? title })

/** Rotas internas carregadas sob demanda (code splitting por módulo). */
export const router = createBrowserRouter([
  {
    element: (
      <Providers>
        <Outlet />
      </Providers>
    ),
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/entrar', element: <LoginPage /> },
          { path: '/recuperar-senha', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/redefinir-senha', element: <ResetPasswordPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            errorElement: <RouteError />,
            children: [
              {
                index: true,
                handle: handle('Visão geral'),
                lazy: () => import('@/features/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })),
              },
              {
                path: 'leads',
                handle: handle('Leads'),
                children: [
                  { index: true, lazy: () => import('@/features/leads/LeadsPage').then((m) => ({ Component: m.LeadsPage })) },
                  {
                    path: ':id',
                    handle: handle('Detalhes do lead', 'Detalhes'),
                    lazy: () => import('@/features/leads/LeadDetailPage').then((m) => ({ Component: m.LeadDetailPage })),
                  },
                ],
              },
              {
                path: 'imoveis',
                handle: handle('Imóveis'),
                children: [
                  { index: true, lazy: () => import('@/features/properties/PropertiesPage').then((m) => ({ Component: m.PropertiesPage })) },
                  {
                    path: 'novo',
                    handle: handle('Novo imóvel', 'Novo'),
                    lazy: () => import('@/features/properties/PropertyFormPage').then((m) => ({ Component: m.NewPropertyPage })),
                  },
                  {
                    path: ':id',
                    handle: handle('Detalhes do imóvel', 'Detalhes'),
                    children: [
                      { index: true, lazy: () => import('@/features/properties/PropertyDetailPage').then((m) => ({ Component: m.PropertyDetailPage })) },
                      {
                        path: 'editar',
                        handle: handle('Editar imóvel', 'Editar'),
                        lazy: () => import('@/features/properties/PropertyFormPage').then((m) => ({ Component: m.EditPropertyPage })),
                      },
                    ],
                  },
                ],
              },
              {
                path: 'contatos',
                handle: handle('Contatos'),
                children: [
                  { index: true, lazy: () => import('@/features/contacts/ContactsPage').then((m) => ({ Component: m.ContactsPage })) },
                  {
                    path: ':id',
                    handle: handle('Detalhes do contato', 'Detalhes'),
                    lazy: () => import('@/features/contacts/ContactDetailPage').then((m) => ({ Component: m.ContactDetailPage })),
                  },
                ],
              },
              {
                path: 'agenda',
                handle: handle('Agenda'),
                lazy: () => import('@/features/calendar/AgendaPage').then((m) => ({ Component: m.AgendaPage })),
              },
              {
                path: 'negociacoes',
                handle: handle('Negociações'),
                children: [
                  { index: true, lazy: () => import('@/features/deals/DealsPage').then((m) => ({ Component: m.DealsPage })) },
                  {
                    path: ':id',
                    handle: handle('Detalhes da negociação', 'Detalhes'),
                    lazy: () => import('@/features/deals/DealDetailPage').then((m) => ({ Component: m.DealDetailPage })),
                  },
                ],
              },
              {
                path: 'relatorios',
                handle: handle('Relatórios'),
                lazy: () => import('@/features/reports/ReportsPage').then((m) => ({ Component: m.ReportsPage })),
              },
              {
                path: 'configuracoes',
                handle: handle('Configurações'),
                lazy: () => import('@/features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
              },
              {
                path: 'busca',
                handle: handle('Pesquisa'),
                lazy: () => import('@/features/search/SearchPage').then((m) => ({ Component: m.SearchPage })),
              },
              { path: '*', handle: handle('Página não encontrada'), element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
])
