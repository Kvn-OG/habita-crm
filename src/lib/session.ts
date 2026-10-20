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

const REPLACED_FLAG = 'crm:session-replaced'

/** A sessão deste navegador foi encerrada por um login da mesma conta em outro dispositivo. */
export function markSessionReplaced() {
  try {
    sessionStorage.setItem(REPLACED_FLAG, '1')
  } catch {
    // Armazenamento indisponível (modo privado): apenas ignora.
  }
}

export function consumeSessionReplacedFlag() {
  try {
    const value = sessionStorage.getItem(REPLACED_FLAG) === '1'
    sessionStorage.removeItem(REPLACED_FLAG)
    return value
  } catch {
    return false
  }
}

// Login aguardando a decisão sobre outra sessão aberta. Fica no localStorage para que,
// se a aba for fechada ou recarregada antes da escolha, o login seja cancelado.
const PENDING_DECISION_FLAG = 'crm:session-decision-pending'

export function setPendingSessionDecision(pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_DECISION_FLAG, '1')
    else localStorage.removeItem(PENDING_DECISION_FLAG)
  } catch {
    // Armazenamento indisponível: a decisão vale só enquanto a página estiver aberta.
  }
}

export function hasPendingSessionDecision() {
  try {
    return localStorage.getItem(PENDING_DECISION_FLAG) === '1'
  } catch {
    return false
  }
}
