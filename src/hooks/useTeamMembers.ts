import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import type { TeamMember } from '@/types/domain'

export const teamMembersKey = ['team-members'] as const

/** Membros ativos da equipe (usado para "corretor responsável"). */
export function useTeamMembers() {
  return useQuery({
    queryKey: teamMembersKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('id,full_name,email,role')
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return (data ?? []) as TeamMember[]
    },
    staleTime: 5 * 60_000,
  })
}

export function memberName(member: Pick<TeamMember, 'full_name' | 'email'>) {
  return member.full_name.trim() || member.email
}
