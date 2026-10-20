/**
 * Canal simples para avisar o AuthProvider de que uma requisição falhou por
 * sessão expirada/inválida (ex.: erro 401 do PostgREST).
 */
type Listener = () => void

const listeners = new Set<Listener>()

export function onSessionExpired(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifySessionExpired() {
  listeners.forEach((listener) => listener())
}

const EXPIRED_FLAG = 'crm:session-expired'

export function markSessionExpired() {
  try {
    sessionStorage.setItem(EXPIRED_FLAG, '1')
  } catch {
    // Armazenamento indisponível (modo privado): apenas ignora.
  }
}

export function consumeSessionExpiredFlag() {
  try {
    const value = sessionStorage.getItem(EXPIRED_FLAG) === '1'
    sessionStorage.removeItem(EXPIRED_FLAG)
    return value
  } catch {
    return false
  }
}
