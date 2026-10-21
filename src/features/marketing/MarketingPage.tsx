import { Megaphone, PanelsTopLeft } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { CampaignsTab } from './components/CampaignsTab'
import { LandingPagesTab } from './components/LandingPagesTab'

type Tab = 'landing-pages' | 'campanhas'

/** Marketing é exclusivo de administradores (investimentos e origem dos leads). */
export function MarketingPage() {
  const { permissions } = useAuth()
  const [params, setParams] = useSearchParams()
  if (!permissions.isAdmin) return <Navigate to="/" replace />
  const tab: Tab = params.get('aba') === 'campanhas' ? 'campanhas' : 'landing-pages'

  return (
    <>
      <PageHeader
        description="Landing pages que enviam leads ao CRM e campanhas de tráfego pago com investimento e resultados."
        actions={
          <SegmentedControl
            label="Seção do marketing"
            value={tab}
            onChange={(value) => setParams(value === 'landing-pages' ? {} : { aba: value }, { replace: true })}
            options={[
              { value: 'landing-pages', label: 'Landing Pages', icon: <PanelsTopLeft /> },
              { value: 'campanhas', label: 'Campanhas', icon: <Megaphone /> },
            ]}
          />
        }
      />
      {tab === 'landing-pages' ? <LandingPagesTab /> : <CampaignsTab />}
    </>
  )
}
