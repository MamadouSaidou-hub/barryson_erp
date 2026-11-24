import { config } from 'dotenv'

// dotenv avant tout import projet (hoisting ESM) — même pattern que seed.ts.
config({ path: '.env.local' })

async function main() {
  const fix = process.argv.includes('--fix')
  const { reconcileStockLevels } = await import('./mutations/stock')

  const { ecarts, corrige } = await reconcileStockLevels({ fix })

  if (ecarts.length === 0) {
    console.log('Stock cohérent : aucun écart entre le cache (stockNiveaux) et les mouvements.')
    return
  }

  console.log(`${ecarts.length} écart(s) détecté(s) entre le cache et la vérité (mouvements) :`)
  for (const e of ecarts) {
    console.log(`  article ${e.articleId} : cache=${e.cache} réel=${e.reel} (écart ${e.reel - e.cache})`)
  }
  if (corrige) {
    console.log('→ Cache corrigé pour correspondre aux mouvements.')
  } else {
    console.log('→ Lecture seule. Relancez avec --fix pour corriger le cache.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
