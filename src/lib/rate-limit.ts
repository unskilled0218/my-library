const attempts = new Map<string, number[]>()

export function assertRateLimit(key: string, limit = 8, windowMs = 60_000) {
  const now = Date.now()
  const recent = (attempts.get(key) ?? []).filter(
    (time) => time > now - windowMs,
  )
  if (recent.length >= limit)
    throw new Error('Too many attempts. Try again shortly.')
  recent.push(now)
  attempts.set(key, recent)
}
