import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/ui/Feedback'
import { formatDate } from '@/lib/format'
import { appointmentKeys, listUpcomingForLead } from '../api'
import { AppointmentItem } from './AppointmentItem'

export function UpcomingAppointments({ leadId }: { leadId: string }) {
  const query = useQuery({ queryKey: appointmentKeys.upcomingForLead(leadId), queryFn: () => listUpcomingForLead(leadId) })

  if (query.isLoading) {
    return (
      <div className="grid place-items-center py-8">
        <Spinner />
      </div>
    )
  }
  if (query.isError) return <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
  if (!query.data?.length) {
    return <EmptyState compact icon={<CalendarDays />} title="Nenhum compromisso agendado" description="Use “Agendar visita” para marcar o próximo encontro." />
  }
  return (
    <ul className="divide-y divide-line">
      {query.data.map((appointment) => (
        <li key={appointment.id}>
          <p className="px-5 pt-3 text-[11px] font-medium text-muted">{formatDate(appointment.starts_at)}</p>
          <div className="-mt-1">
            <AppointmentItem appointment={appointment} compact />
          </div>
        </li>
      ))}
    </ul>
  )
}
