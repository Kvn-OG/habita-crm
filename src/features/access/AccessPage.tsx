import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { TeamSettings } from '@/features/settings/components/TeamSettings'

/** Gestão dos acessos ao CRM: exclusiva de administradores. */
export function AccessPage() {
  const { permissions } = useAuth()
  if (!permissions.isAdmin) return <Navigate to="/" replace />
  return (
    <>
      <PageHeader description="Crie acessos com senha provisória, defina o papel de cada pessoa, desative ou exclua quem não faz mais parte da equipe." />
      <TeamSettings />
    </>
  )
}
