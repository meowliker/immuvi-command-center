import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { projectSnapshot } from '../lib/data/project'
import { selectProduct } from '../lib/data/select'
import { PRODUCTS } from '../lib/products'

async function main() {
  const productName = process.argv.find(arg => arg.startsWith('--product='))?.slice(10)
  const product = productName ? PRODUCTS.find(item => item.name === productName) : undefined
  if (productName && !product) throw new Error('Unknown Strategist product')
  const snapshot = selectProduct(await projectSnapshot(), product?.key ?? 'all')
  const directory = path.join(process.cwd(), 'data')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const filename = product ? `snapshot-${product.key}.json` : 'snapshot.json'
  await writeFile(path.join(directory, filename), JSON.stringify(snapshot, null, 2), { mode: 0o600 })
  const totals = snapshot.totals
  console.log(`${totals.tasks} tasks, ${totals.winners} winners, ${totals.losers} losers`)
  console.log(`${totals.analysed} tasks analysed, ${totals.mismatches} field mismatches`)
  console.log(`Snapshot written: data/${filename}`)
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error.message)
  process.exit(1)
})
