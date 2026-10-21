import { UserRound, Workflow } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PipelineSettings } from './components/PipelineSettings'
import { ProfileSettings } from './components/ProfileSettings'

type Tab = 'perfil' | 'funis'

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  // Corretores veem apenas o próprio perfil; os funis são configurados pelo administrador.
  const showAdminTabs = useAuth().permissions.isAdmin
  const tab: Tab = showAdminTabs && params.get('aba') === 'funis' ? 'funis' : 'perfil'

  return (
    <>
      <PageHeader
        description={showAdminTabs ? 'Seu perfil e as etapas dos funis comerciais.' : 'Seus dados pessoais, foto e senha.'}
        actions={
          showAdminTabs && (
          <SegmentedControl
            label="Seção das configurações"
            value={tab}
            onChange={(value) => setParams(value === 'perfil' ? {} : { aba: value }, { replace: true })}
            options={[
              { value: 'perfil', label: 'Meu perfil', icon: <UserRound /> },
              { value: 'funis', label: 'Funis', icon: <Workflow /> },
            ]}
          />
          )
        }
      />
      {tab === 'perfil' && <ProfileSettings />}
      {tab === 'funis' && <PipelineSettings />}
    </>
  )
}
