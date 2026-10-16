import { getKyoboBook, probeKyoboSearch, searchKyobo } from '../src/lib/kyobo'

async function main() {
  const args = process.argv.slice(2)
  const compare = args.includes('--compare-search')
  const details = args.includes('--details')
  const keyword =
    args
      .filter((arg) => arg !== '--compare-search' && arg !== '--details')
      .join(' ') || '9791157107223'
  if (compare) {
    const report = await probeKyoboSearch(keyword)
    console.log(
      JSON.stringify(
        { checkedAt: new Date().toISOString(), ...report },
        null,
        2,
      ),
    )
    if (report.error) process.exitCode = 1
    return
  }
  const results = await searchKyobo(keyword)
  const report: Record<string, unknown> = {
    keyword,
    resultCount: results.length,
    results,
  }
  if (details && results[0])
    report.detail = await getKyoboBook(results[0].saleId)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
