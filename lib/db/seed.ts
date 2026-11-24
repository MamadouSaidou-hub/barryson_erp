import { config } from 'dotenv'

// dotenv must run before anything below is imported — static `import` statements are hoisted
// above this call by the compiler, so every project-local import is done dynamically inside
// main() instead (same workaround used for the one-off BILMS inspection scripts).
config({ path: '.env.local' })

const DEMO_PASSWORD = 'ChangeMoi123!'

const DEMO_USERS = [
  { email: 'dg.demo@barryson.local', name: 'Démo — Directeur général', role: 'dg' },
  { email: 'stock.demo@barryson.local', name: 'Démo — Responsable stock', role: 'resp_stock' },
  { email: 'prod.demo@barryson.local', name: 'Démo — Chef de production', role: 'chef_prod' },
  { email: 'commercial.demo@barryson.local', name: 'Démo — Directeur commercial', role: 'dir_commercial' },
  { email: 'compta.demo@barryson.local', name: 'Démo — Comptable', role: 'comptable' },
] as const

// Catalogue de départ du cahier des charges §6.3 : 5 couleurs de bobines jumbo BOPP (préremplies
// depuis le fichier client Barryson_102_bobines_import.xlsx) + le tube papier + quelques
// semi-finis/produit fini de référence.
const SEED_ARTICLES = [
  {
    code: 'BOB-GOLDEN01',
    name: 'Bobine BOPP or transparent — Golden01',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine BOPP or transparent — Golden01', finish: 'or transparent', supplierRef: 'Golden01', typicalNetWeightKg: 252, typicalLengthM: 4007 },
  },
  {
    code: 'BOB-GOLDEN03',
    name: 'Bobine BOPP or transparent — Golden03',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine BOPP or transparent — Golden03', finish: 'or transparent', supplierRef: 'Golden03', typicalNetWeightKg: 252, typicalLengthM: 3997 },
  },
  {
    code: 'BOB-YELLOWISH',
    name: 'Bobine BOPP jaune transparent — Yellowish',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine BOPP jaune transparent — Yellowish', finish: 'jaune transparent', supplierRef: 'Yellowish', typicalNetWeightKg: 250, typicalLengthM: 3994 },
  },
  {
    code: 'BOB-CLEARWHITE',
    name: 'Bobine BOPP transparent clair — Clear White',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine BOPP transparent clair — Clear White', finish: 'transparent clair', supplierRef: 'Clear White', typicalNetWeightKg: 252, typicalLengthM: 4015 },
  },
  {
    code: 'BOB-BROWN',
    name: 'Bobine BOPP kaki simple — Brown',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine BOPP kaki simple — Brown', finish: 'kaki simple', supplierRef: 'Brown', typicalNetWeightKg: 254, typicalLengthM: 4039 },
  },
  {
    code: 'BOB-JUMBO-1280',
    name: 'Bobine jumbo BOPP 1280 mm',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine jumbo BOPP 1280 mm' },
  },
  {
    code: 'TUBE-45',
    name: 'Tube papier 45 mm (carton de 500 pièces)',
    level: 'semi_fini' as const,
    unit: 'carton' as const,
    catalogue: { label: 'Tube papier 45 mm (carton de 500 pièces)' },
  },
  {
    code: 'CARTON-VIDE-BARRYSON',
    name: 'Carton vide Barryson Adhésif',
    level: 'semi_fini' as const,
    unit: 'carton' as const,
    catalogue: { label: 'Carton vide Barryson Adhésif' },
  },
  {
    code: 'PANIER-DECOUPE',
    name: 'Panier de pièces découpées (acheté)',
    level: 'semi_fini' as const,
    unit: 'panier' as const,
    catalogue: { label: 'Panier de pièces découpées (acheté)' },
  },
  {
    code: 'PLASTIQUE-RETRACTABLE',
    name: 'Plastique rétractable',
    level: 'semi_fini' as const,
    unit: 'kg' as const,
    catalogue: { label: 'Plastique rétractable (pour couvrir les rouleaux avant mise en carton)' },
  },
  {
    code: 'PF-BSG30-45X25',
    name: 'BSG 30 — 45 mm × 25 m (carton de 90)',
    level: 'produit_fini' as const,
    // Compté en pièces, pas en cartons : un lot de production ne tombe presque jamais sur un
    // nombre exact de cartons pleins, donc compter en pièces évite de perdre le reliquat à
    // chaque lot (nombre de cartons pleins = pièces ÷ pièces par carton, calculé à la volée).
    unit: 'piece' as const,
    catalogue: null,
  },
  // Données de test supplémentaires (§6.2/§8) : quelques autres modèles réels de l'usine, pour
  // que le menu "Nouvelle fabrication" ne propose pas qu'un seul choix.
  {
    code: 'BOB-PVC-NOIR',
    name: 'Bobine PVC isolant noir',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine PVC isolant noir', finish: 'noir mat' },
  },
  {
    code: 'BOB-MASQUAGE',
    name: 'Bobine masquage beige',
    level: 'semi_fini' as const,
    unit: 'rouleau' as const,
    catalogue: { label: 'Bobine masquage beige', finish: 'beige' },
  },
  {
    code: 'PF-BSG48-48X50',
    name: 'BSG 48 — 48 mm × 50 m (carton de 60)',
    level: 'produit_fini' as const,
    unit: 'piece' as const,
    catalogue: null,
  },
  {
    code: 'PF-BSG24-24X40',
    name: 'BSG 24 transparent — 24 mm × 40 m (carton de 120)',
    level: 'produit_fini' as const,
    unit: 'piece' as const,
    catalogue: null,
  },
  {
    code: 'PF-PVC-19X10',
    name: 'Ruban PVC électrique — 19 mm × 10 m (carton de 100)',
    level: 'produit_fini' as const,
    unit: 'piece' as const,
    catalogue: null,
  },
  {
    code: 'PF-MASQ-24X40',
    name: 'Ruban de masquage — 24 mm × 40 m (carton de 72)',
    level: 'produit_fini' as const,
    unit: 'piece' as const,
    catalogue: null,
  },
]

// Modèles de ruban de démo (§15.7, §6.2, §8). Le premier (BSG 30) permet de rejouer les 3 cas de
// test du cahier des charges dès après le seed (3900m → 48 cartons + 48 restantes ; 4000m → 49 +
// 70 ; 4100m → 51 + 2) ; les suivants donnent au menu "Nouvelle fabrication" un choix réaliste
// entre plusieurs modèles/familles plutôt qu'une seule option. Deux d'entre eux configurent le
// groupage/plastique rétractable (§ réel usine) pour montrer la consommation de plastique.
const SEED_MODELES_RUBAN = [
  {
    name: 'BSG 30',
    famille: 'bopp' as const,
    largeurMm: 45,
    longueurRouleauM: 25,
    piecesParTour: 28,
    piecesParCarton: 90,
    piecesParPaquet: 10,
    plastiqueKgParPaquet: 0.2,
    bobineArticleCode: 'BOB-GOLDEN01',
    tubeArticleCode: 'TUBE-45',
    cartonArticleCode: 'CARTON-VIDE-BARRYSON',
    plastiqueArticleCode: 'PLASTIQUE-RETRACTABLE',
    produitFiniArticleCode: 'PF-BSG30-45X25',
  },
  {
    name: 'BSG 48',
    famille: 'bopp' as const,
    largeurMm: 48,
    longueurRouleauM: 50,
    piecesParTour: 20,
    piecesParCarton: 60,
    piecesParPaquet: 6,
    plastiqueKgParPaquet: 0.25,
    bobineArticleCode: 'BOB-GOLDEN03',
    tubeArticleCode: 'TUBE-45',
    cartonArticleCode: 'CARTON-VIDE-BARRYSON',
    plastiqueArticleCode: 'PLASTIQUE-RETRACTABLE',
    produitFiniArticleCode: 'PF-BSG48-48X50',
  },
  {
    name: 'BSG 24 transparent',
    famille: 'bopp' as const,
    largeurMm: 24,
    longueurRouleauM: 40,
    piecesParTour: 40,
    piecesParCarton: 120,
    bobineArticleCode: 'BOB-CLEARWHITE',
    tubeArticleCode: 'TUBE-45',
    cartonArticleCode: 'CARTON-VIDE-BARRYSON',
    produitFiniArticleCode: 'PF-BSG24-24X40',
  },
  {
    name: 'Ruban PVC électrique 19mm',
    famille: 'pvc_electrique' as const,
    largeurMm: 19,
    longueurRouleauM: 10,
    piecesParTour: 50,
    piecesParCarton: 100,
    bobineArticleCode: 'BOB-PVC-NOIR',
    tubeArticleCode: 'TUBE-45',
    cartonArticleCode: 'CARTON-VIDE-BARRYSON',
    produitFiniArticleCode: 'PF-PVC-19X10',
  },
  {
    name: 'Ruban de masquage 24mm',
    famille: 'masquage' as const,
    largeurMm: 24,
    longueurRouleauM: 40,
    piecesParTour: 30,
    piecesParCarton: 72,
    bobineArticleCode: 'BOB-MASQUAGE',
    tubeArticleCode: 'TUBE-45',
    cartonArticleCode: 'CARTON-VIDE-BARRYSON',
    produitFiniArticleCode: 'PF-MASQ-24X40',
  },
]

// Stock de départ (test/démo uniquement) pour que les modèles ci-dessus soient immédiatement
// utilisables dans "Nouvelle fabrication" sans buter sur "Stock insuffisant" — correspond aux
// articles semi-finis consommés par les modèles de ruban de démo.
const SEED_STOCK_INITIAL: { articleCode: string; quantite: number }[] = [
  { articleCode: 'BOB-GOLDEN01', quantite: 20 },
  { articleCode: 'BOB-GOLDEN03', quantite: 15 },
  { articleCode: 'BOB-CLEARWHITE', quantite: 15 },
  { articleCode: 'BOB-PVC-NOIR', quantite: 15 },
  { articleCode: 'BOB-MASQUAGE', quantite: 15 },
  { articleCode: 'TUBE-45', quantite: 50_000 },
  { articleCode: 'CARTON-VIDE-BARRYSON', quantite: 2000 },
  { articleCode: 'PLASTIQUE-RETRACTABLE', quantite: 500 },
]

async function main() {
  const { eq } = await import('drizzle-orm')
  const { auth } = await import('../auth')
  const { db } = await import('./client')
  const { user } = await import('./auth-schema')
  const { articles, catalogueProduits, modelesRuban, clients, stockNiveaux } = await import('./schema')
  const { recordManualStockMovement } = await import('./mutations/stock')
  const seedActor = { userId: 'seed-script', userName: 'Script de seed' }

  for (const demo of DEMO_USERS) {
    const [existing] = await db.select().from(user).where(eq(user.email, demo.email))
    if (existing) {
      console.log(`Compte démo déjà présent : ${demo.email}`)
      continue
    }
    await auth.api.signUpEmail({ body: { email: demo.email, password: DEMO_PASSWORD, name: demo.name } })
    await db.update(user).set({ role: demo.role }).where(eq(user.email, demo.email))
    console.log(`Compte démo créé : ${demo.email} (${demo.role})`)
  }

  for (const seedArticle of SEED_ARTICLES) {
    const [existing] = await db.select().from(articles).where(eq(articles.code, seedArticle.code))
    if (existing) {
      console.log(`Article déjà présent : ${seedArticle.code}`)
      continue
    }
    const [article] = await db
      .insert(articles)
      .values({ code: seedArticle.code, name: seedArticle.name, level: seedArticle.level, unit: seedArticle.unit })
      .returning()
    if (seedArticle.catalogue) {
      await db.insert(catalogueProduits).values({ articleId: article.id, ...seedArticle.catalogue })
    }
    console.log(`Article créé : ${seedArticle.code}`)
  }

  for (const seedModele of SEED_MODELES_RUBAN) {
    const [existingModele] = await db.select().from(modelesRuban).where(eq(modelesRuban.name, seedModele.name))
    if (existingModele) {
      console.log(`Modèle de ruban déjà présent : ${seedModele.name}`)
      continue
    }
    const [bobine] = await db.select().from(articles).where(eq(articles.code, seedModele.bobineArticleCode))
    const [tube] = await db.select().from(articles).where(eq(articles.code, seedModele.tubeArticleCode))
    const [carton] = await db.select().from(articles).where(eq(articles.code, seedModele.cartonArticleCode))
    const [produitFini] = await db.select().from(articles).where(eq(articles.code, seedModele.produitFiniArticleCode))
    const plastique = seedModele.plastiqueArticleCode
      ? (await db.select().from(articles).where(eq(articles.code, seedModele.plastiqueArticleCode)))[0]
      : undefined
    await db.insert(modelesRuban).values({
      name: seedModele.name,
      famille: seedModele.famille,
      largeurMm: seedModele.largeurMm,
      longueurRouleauM: seedModele.longueurRouleauM,
      piecesParTour: seedModele.piecesParTour,
      piecesParCarton: seedModele.piecesParCarton,
      piecesParPaquet: 'piecesParPaquet' in seedModele ? seedModele.piecesParPaquet : null,
      plastiqueKgParPaquet: 'plastiqueKgParPaquet' in seedModele ? seedModele.plastiqueKgParPaquet : null,
      bobineArticleId: bobine.id,
      tubeArticleId: tube.id,
      cartonArticleId: carton.id,
      plastiqueArticleId: plastique?.id ?? null,
      produitFiniArticleId: produitFini.id,
    })
    console.log(`Modèle de ruban créé : ${seedModele.name}`)
  }

  for (const seedStock of SEED_STOCK_INITIAL) {
    const [article] = await db.select().from(articles).where(eq(articles.code, seedStock.articleCode))
    if (!article) continue
    const [existingNiveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, article.id))
    if (existingNiveau) {
      console.log(`Stock déjà initialisé pour : ${seedStock.articleCode}`)
      continue
    }
    await recordManualStockMovement({ articleId: article.id, direction: 'entree', quantite: seedStock.quantite, motif: 'Stock initial de démo' }, seedActor)
    console.log(`Stock initial créé pour ${seedStock.articleCode} : ${seedStock.quantite}`)
  }

  const seedClientName = 'Client Démo Conakry'
  const [existingClient] = await db.select().from(clients).where(eq(clients.name, seedClientName))
  if (existingClient) {
    console.log(`Client déjà présent : ${seedClientName}`)
  } else {
    await db.insert(clients).values({
      code: 'CLIENT-DEMO-CONAKRY',
      name: seedClientName,
      segment: 'Revendeur',
      zone: 'Conakry',
      delaiPaiementJours: 30,
      plafondEncours: 5_000_000,
    })
    console.log(`Client créé : ${seedClientName}`)
  }

  console.log('')
  console.log(`Mot de passe des comptes démo (y compris admin.demo) : ${DEMO_PASSWORD} — à changer avant mise en production.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
