import { normalizeIsbn } from '@/lib/validation'

export function isbnIdentity(input: string): string | null {
  const isbn = normalizeIsbn(input).toUpperCase()
  return /^(?:\d{13}|\d{9}[\dX])$/.test(isbn) ? isbn : null
}

function isbn13CheckDigit(body: string) {
  const sum = [...body].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  )
  return String((10 - (sum % 10)) % 10)
}

function equivalentIsbn13(isbn: string): string | null {
  if (isbn.length === 13)
    return isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12] ? isbn : null
  const sum = [...isbn].reduce(
    (total, digit, index) =>
      total + (digit === 'X' ? 10 : Number(digit)) * (10 - index),
    0,
  )
  if (sum % 11) return null
  const body = `978${isbn.slice(0, 9)}`
  return body + isbn13CheckDigit(body)
}

export function isSameIsbn(left: string, right: string) {
  const a = isbnIdentity(left)
  const b = isbnIdentity(right)
  if (!a || !b) return false
  if (a === b) return true
  const canonical = equivalentIsbn13(a)
  return canonical !== null && canonical === equivalentIsbn13(b)
}
