const LOCALE = 'pt-BR'
const TIME_ZONE = 'America/Sao_Paulo'

const currencyFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' })
const compactCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const numberFormatter = new Intl.NumberFormat(LOCALE)
const decimalFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
})
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
})
const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
})
const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

type Numeric = number | string | null | undefined

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatCurrency(value: Numeric, fallback = '—') {
  const parsed = toNumber(value)
  return parsed === null ? fallback : currencyFormatter.format(parsed)
}

export function formatCompactCurrency(value: Numeric, fallback = '—') {
  const parsed = toNumber(value)
  return parsed === null ? fallback : compactCurrencyFormatter.format(parsed)
}

export function formatNumber(value: Numeric, fallback = '—') {
  const parsed = toNumber(value)
  return parsed === null ? fallback : numberFormatter.format(parsed)
}

export function formatArea(value: Numeric, fallback = '—') {
  const parsed = toNumber(value)
  return parsed === null ? fallback : `${decimalFormatter.format(parsed)} m²`
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** dd/MM/yyyy */
export function formatDate(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value)
  return date ? dateFormatter.format(date) : fallback
}

/** HH:mm (24 horas) */
export function formatTime(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value)
  return date ? timeFormatter.format(date) : fallback
}

/** dd/MM/yyyy às HH:mm */
export function formatDateTime(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value)
  return date ? `${dateFormatter.format(date)} às ${timeFormatter.format(date)}` : fallback
}

export function formatLongDate(value: Date = new Date()) {
  const text = longDateFormatter.format(value)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()) {
  const date = toDate(value)
  if (!date) return '—'
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSeconds)
  if (abs < 60) return 'agora'
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 86400 * 30) return relativeFormatter.format(Math.round(diffSeconds / 86400), 'day')
  return formatDate(date)
}

// ---------------------------------------------------------------------------
// Telefones e CEP
// ---------------------------------------------------------------------------

/** Mantém apenas dígitos e remove o código do país (55) quando presente. */
export function normalizePhone(value: string | null | undefined) {
  let digits = (value ?? '').replace(/\D/g, '')
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)
  return digits
}

export function formatPhone(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  const digits = normalizePhone(value)
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return value
}

/** Máscara progressiva para digitação: (11) 99999-9999 */
export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Máscara progressiva: 29140-000 */
export function maskCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function formatCep(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  return maskCep(value)
}

// ---------------------------------------------------------------------------
// Números digitados no padrão brasileiro
// ---------------------------------------------------------------------------

/**
 * Converte texto no padrão brasileiro ("1.234,56") em número.
 * Retorna null para vazio e NaN para entradas inválidas (o Zod reporta o erro).
 */
export function parseDecimalBR(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return Number.NaN
  return Number(normalized)
}

export function formatDecimalInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return decimalFormatter.format(value)
}

/** Converte os dígitos digitados em centavos para reais (máscara de moeda). */
export function centsDigitsToNumber(digits: string): number | null {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (clean === '') return null
  return Number(clean) / 100
}

export function formatCurrencyInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return currencyFormatter.format(value)
}

// ---------------------------------------------------------------------------
// Datas para inputs nativos (sempre no fuso de São Paulo)
// ---------------------------------------------------------------------------

/** ISO → "yyyy-MM-ddTHH:mm" no horário local do navegador (para <input type="datetime-local">). */
export function toDateTimeLocalInput(value: string | null | undefined) {
  const date = toDate(value)
  if (!date) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function fromDateTimeLocalInput(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
