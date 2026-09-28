import { getKyoboBook, searchKyobo } from '../src/lib/kyobo'

async function main() {
  const keyword = process.argv.slice(2).join(' ') || '9791157107223'
  const results = await searchKyobo(keyword)
  const report: Record<string, unknown> = {
    keyword,
    resultCount: results.length,
    results,
  }
  if (/^\d{10,13}$/.test(keyword.replace(/[-\s]/g, '')) && results[0])
    report.detail = await getKyoboBook(results[0].saleId)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
