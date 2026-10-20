import { describe, expect, it } from 'vitest'
import {
  centsDigitsToNumber, formatArea, formatCep, formatCurrency, formatCurrencyInput, formatDate, formatDateTime, formatPhone,
  formatTime, maskCep, maskPhone, normalizePhone, parseDecimalBR,
} from './format'

// Intl usa espaço não separável entre "R$" e o valor.
const nbsp = (text: string) => text.replaceAll(String.fromCharCode(160), ' ')

describe('moeda (BRL)', () => {
  it('formata valores em reais', () => {
    expect(nbsp(formatCurrency(350000))).toBe('R$ 350.000,00')
    expect(nbsp(formatCurrency('1234.5'))).toBe('R$ 1.234,50')
  })
  it('usa traço para valores ausentes', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency(undefined)).toBe('—')
  })
  it('converte dígitos digitados em centavos', () => {
    expect(centsDigitsToNumber('R$ 1.234,56')).toBe(1234.56)
    expect(centsDigitsToNumber('5')).toBe(0.05)
    expect(centsDigitsToNumber('')).toBeNull()
    expect(nbsp(formatCurrencyInput(1234.56))).toBe('R$ 1.234,56')
  })
})

describe('datas e horários', () => {
  it('formata no padrão dd/MM/yyyy e 24 horas (horário de Brasília)', () => {
    const iso = '2026-03-05T21:30:00Z' // 18:30 em São Paulo
    expect(formatDate(iso)).toBe('05/03/2026')
    expect(formatTime(iso)).toBe('18:30')
    expect(formatDateTime(iso)).toBe('05/03/2026 às 18:30')
  })
  it('lida com valores inválidos', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('não é data')).toBe('—')
  })
})

describe('telefones', () => {
  it('normaliza para dígitos e remove o código do país', () => {
    expect(normalizePhone('(11) 99999-0001')).toBe('11999990001')
    expect(normalizePhone('+55 11 99999-0001')).toBe('11999990001')
  })
  it('formata celulares e fixos', () => {
    expect(formatPhone('11999990001')).toBe('(11) 99999-0001')
    expect(formatPhone('1133330000')).toBe('(11) 3333-0000')
  })
  it('aplica máscara progressiva', () => {
    expect(maskPhone('11')).toBe('(11')
    expect(maskPhone('119999')).toBe('(11) 9999')
    expect(maskPhone('11999990001')).toBe('(11) 99999-0001')
    expect(maskPhone('119999900019999')).toBe('(11) 99999-0001')
  })
})

describe('CEP e números', () => {
  it('aplica máscara de CEP', () => {
    expect(maskCep('29140000')).toBe('29140-000')
    expect(maskCep('2914')).toBe('2914')
    expect(formatCep('29140000')).toBe('29140-000')
  })
  it('interpreta decimais no padrão brasileiro', () => {
    expect(parseDecimalBR('1.234,56')).toBe(1234.56)
    expect(parseDecimalBR('120,5')).toBe(120.5)
    expect(parseDecimalBR('85')).toBe(85)
    expect(parseDecimalBR('')).toBeNull()
    expect(parseDecimalBR('abc')).toBeNaN()
  })
  it('formata áreas', () => {
    expect(formatArea(120.5)).toBe('120,5 m²')
  })
})
