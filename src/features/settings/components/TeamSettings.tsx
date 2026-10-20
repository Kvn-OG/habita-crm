import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/Toast'
import { Select } from '@/components/forms/inputs'
import { UserAvatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Feedback'
import { teamMembersKey } from '@/hooks/useTeamMembers'
import { getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { roleLabels, toOptions } from '@/lib/labels'
import type { AppRole, Profile } from '@/types/domain'
import { listProfiles, settingsKeys, updateMemberAccess } from '../api'
import { CreateAccessModal, ResetPasswordModal } from './AccessModals'

export function TeamSettings() {
  const { permissions, profile: me } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [toDeactivate, setToDeactivate] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<Profile | null>(null)
  const query = useQuery({ queryKey: settingsKeys.profiles, queryFn: listProfiles })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: AppRole; is_active?: boolean } }) => updateMemberAccess(id, patch),
    onSuccess: async (_data, { patch }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.profiles }),
        queryClient.invalidateQueries({ queryKey: teamMembersKey }),
      ])
      setToDeactivate(null)
      toast.success(patch.is_active === undefined ? 'Papel atualizado.' : patch.is_active ? 'Acesso liberado.' : 'Acesso desativado.')
    },
    onError: (error) => toast.error('Não foi possível atualizar o acesso', getErrorMessage(error)),
  })

  const pending = (query.data ?? []).filter((member) => !member.is_active)

  return (
    <div className="space-y-5">
      {!permissions.canManageSettings && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Info className="size-3.5" aria-hidden="true" /> Somente administradores podem alterar papéis e liberar acessos.
        </p>
      )}

      <Card>
        <CardHeader
          title="Equipe"
          description={query.data ? `${query.data.length - pending.length} ativo(s) · ${pending.length} pendente(s) ou desativado(s)` : undefined}
          actions={
            permissions.canManageSettings && (
              <Button icon={<UserPlus />} onClick={() => setCreating(true)}>
                Novo acesso
              </Button>
            )
          }
        />
        {query.isLoading ? (
          <TableSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <ul className="divide-y divide-line">
            {(query.data ?? []).map((member) => {
              const isMe = member.id === me?.id
              const editable = permissions.canManageSettings && !isMe
              const name = member.full_name.trim() || member.email
              return (
                <li key={member.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar name={name} avatarPath={member.avatar_path} size="md" className={member.is_active ? undefined : 'opacity-50'} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                        <span className="truncate">{name}</span>
                        {isMe && <Badge tone="neutral">Você</Badge>}
                        {!member.is_active && <Badge tone="warning" dot>Aguardando liberação</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {member.email} · desde {formatDate(member.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    {editable ? (
                      <>
                        <div className="w-40">
                          <Select
                            aria-label={`Papel de ${name}`}
                            className="h-8 text-[13px]"
                            value={member.role}
                            disabled={update.isPending}
                            onChange={(event) => update.mutate({ id: member.id, patch: { role: event.target.value as AppRole } })}
                          >
                            {toOptions(roleLabels).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button size="sm" variant="ghost" icon={<KeyRound />} onClick={() => setResetting(member)}>
                          Redefinir senha
                        </Button>
                        {member.is_active ? (
                          <Button size="sm" variant="ghost" icon={<UserX />} onClick={() => setToDeactivate(member)}>
                            Desativar
                          </Button>
                        ) : (
                          <Button size="sm" variant="accent" icon={<UserCheck />} loading={update.isPending} onClick={() => update.mutate({ id: member.id, patch: { is_active: true } })}>
                            Liberar acesso
                          </Button>
                        )}
                      </>
                    ) : (
                      <Badge tone={member.role === 'admin' ? 'accent' : 'neutral'}>{roleLabels[member.role]}</Badge>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <CreateAccessModal open={creating} onClose={() => setCreating(false)} />
      <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={toDeactivate !== null}
        title="Desativar acesso?"
        description={
          <>
            <strong className="text-ink">{toDeactivate?.full_name || toDeactivate?.email}</strong> deixará de acessar os dados do CRM imediatamente. Os registros criados por essa pessoa são mantidos e o acesso pode ser liberado novamente depois.
          </>
        }
        confirmLabel="Desativar acesso"
        loading={update.isPending}
        onConfirm={() => toDeactivate && update.mutate({ id: toDeactivate.id, patch: { is_active: false } })}
        onCancel={() => setToDeactivate(null)}
      />
    </div>
  )
}
