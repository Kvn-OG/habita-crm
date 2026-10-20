import { useQuery } from '@tanstack/react-query'
import { AVATARS_BUCKET, getSupabase } from '@/lib/supabase'

const SIGNED_URL_SECONDS = 60 * 60

/** URL assinada (temporária) da foto de perfil; o bucket é privado. */
export function useAvatarUrl(path: string | null | undefined) {
  const query = useQuery({
    queryKey: ['avatar-url', path],
    enabled: Boolean(path),
    queryFn: async () => {
      const { data, error } = await getSupabase().storage.from(AVATARS_BUCKET).createSignedUrl(path as string, SIGNED_URL_SECONDS)
      if (error) throw error
      return data.signedUrl
    },
    staleTime: (SIGNED_URL_SECONDS - 5 * 60) * 1000,
    gcTime: SIGNED_URL_SECONDS * 1000,
    retry: false,
  })
  return path ? query.data : undefined
}
