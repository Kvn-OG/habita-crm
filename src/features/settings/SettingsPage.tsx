import { UserRound, UsersRound, Workflow } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PipelineSettings } from './components/PipelineSettings'
import { ProfileSettings } from './components/ProfileSettings'
import { TeamSettings } from './components/TeamSettings'

type Tab = 'perfil' | 'equipe' | 'funis'

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  // Corretores veem apenas o próprio perfil; equipe e funis são assuntos da gestão.
  const showAdminTabs = useAuth().permissions.canViewReports
  const raw = params.get('aba')
  const tab: Tab = showAdminTabs && (raw === 'equipe' || raw === 'funis') ? raw : 'perfil'

  return (
    <>
      <PageHeader
        description={showAdminTabs ? 'Seu perfil, a equipe com acesso ao CRM e as etapas dos funis comerciais.' : 'Seus dados pessoais, foto e senha.'}
        actions={
          showAdminTabs && (
          <SegmentedControl
            label="Seção das configurações"
            value={tab}
            onChange={(value) => setParams(value === 'perfil' ? {} : { aba: value }, { replace: true })}
            options={[
              { value: 'perfil', label: 'Meu perfil', icon: <UserRound /> },
              { value: 'equipe', label: 'Equipe', icon: <UsersRound /> },
              { value: 'funis', label: 'Funis', icon: <Workflow /> },
            ]}
          />
          )
        }
      />
      {tab === 'perfil' && <ProfileSettings />}
      {tab === 'equipe' && <TeamSettings />}
      {tab === 'funis' && <PipelineSettings />}
    </>
  )
}
