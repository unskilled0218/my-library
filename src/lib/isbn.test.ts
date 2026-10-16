import { describe, expect, it } from 'vitest'
import { isbnIdentity, isSameIsbn } from '@/lib/isbn'

describe('search ISBN identity', () => {
  it.each([
    [' 978-0-13-235088-4 ', '9780132350884'],
    ['0-9752298-0-x', '097522980X'],
    ['0132350882', '0132350882'],
    ['12345678901', null],
    ['123456789012', null],
    ['Clean - Code', null],
    ['12345678XX', null],
  ])('normalizes supported ISBN shapes only: %s', (input, expected) => {
    expect(isbnIdentity(input)).toBe(expected)
  })

  it.each([
    ['0132350882', '9780132350884', true],
    ['9780132350884', '0132350882', true],
    ['097522980X', '9780975229804', true],
    ['0-9752298-0-x', '9780975229804', true],
    ['9790132350883', '0132350882', false],
    ['9780132350885', '0132350882', false],
    ['0132350883', '9780132350884', false],
    ['9780132350884', '9780201633610', false],
    ['1234567890', '1234567890', true],
    ['9791157107223', '9791157107223', true],
    ['12345678901', '12345678901', false],
  ])(
    'matches %s to %s only when exact or safely equivalent',
    (left, right, expected) => {
      expect(isSameIsbn(left, right)).toBe(expected)
    },
  )
})
