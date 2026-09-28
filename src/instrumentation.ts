export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapAdmin } = await import('@/lib/admin-bootstrap')
    await bootstrapAdmin()
  }
}
