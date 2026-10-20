import { useState } from 'react'
import { useAvatarUrl } from '@/hooks/useAvatarUrl'
import { cn, initials } from '@/lib/utils'

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-9 text-[13px]',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl',
}

export function Avatar({
  name,
  src,
  size = 'md',
  tone = 'soft',
  className,
}: {
  name: string
  /** Foto; sem ela (ou se falhar ao carregar) são exibidas as iniciais. */
  src?: string
  size?: keyof typeof sizes
  tone?: 'soft' | 'brand' | 'accent'
  className?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold tracking-wide select-none',
        tone === 'soft' && 'bg-brand-100 text-brand-800',
        tone === 'brand' && 'bg-brand-800 text-white',
        tone === 'accent' && 'bg-mint text-brand-900',
        sizes[size],
        className,
      )}
    >
      {showImage ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailedSrc(src ?? null)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}

/** Avatar de um membro da equipe, com a foto de perfil quando houver. */
export function UserAvatar({ avatarPath, ...props }: Omit<Parameters<typeof Avatar>[0], 'src'> & { avatarPath?: string | null }) {
  const src = useAvatarUrl(avatarPath)
  return <Avatar {...props} src={src} />
}
