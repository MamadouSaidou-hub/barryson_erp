import { relations, sql } from 'drizzle-orm'
import { bigint, boolean, check, doublePrecision, index, integer, jsonb, pgTable, serial, text, uniqueIndex } from 'drizzle-orm/pg-core'

// Un montant en GNF est toujours un nombre ENTIER de francs : le franc guinéen n'a pas de
// subdivision utilisée en pratique (pas de centimes). On les stocke donc en `bigint` entier
// (`mode: 'number'` → manipulé comme un `number` JS, exact jusqu'à 2^53, largement suffisant), et
// jamais en flottant : additionner des flottants (encours, créances, soldes) peut accumuler des
// erreurs d'arrondi invisibles qui divergent avec le temps — inacceptable pour un système
// financier. Les prix d'achat en devise étrangère (USD/EUR/CNY) restent en `doublePrecision` :
// ces devises ont de vrais centimes, et ce sont des estimations indicatives jamais sommées dans
// un solde exact. Les quantités (kg, m) restent aussi en flottant car réellement fractionnaires.
const gnf = (name: string) => bigint(name, { mode: 'number' })

const timestamps = {
  // JS-side default (not a DB-level `now()`) so every timestamp in the app is generated the same
  // way and stays safely string-comparable, regardless of DB engine — same convention as
  // bgm-management-system/BILMS.
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}

// ---------------------------------------------------------------------------
// Réglages : articles, fournisseurs, catalogue de produits (§5.7, §6.2, §6.3)
// ---------------------------------------------------------------------------

export const articleLevels = ['matiere_premiere', 'semi_fini', 'produit_fini'] as const
export type ArticleLevel = (typeof articleLevels)[number]

export const articleUnits = ['kg', 'm', 'rouleau', 'piece', 'panier', 'carton'] as const
export type ArticleUnit = (typeof articleUnits)[number]

export const articles = pgTable(
  'articles',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    level: text('level', { enum: articleLevels }).notNull(),
    unit: text('unit', { enum: articleUnits }).notNull(),
    seuilMin: doublePrecision('seuil_min'),
    seuilMax: doublePrecision('seuil_max'),
    // Jamais de suppression (§5.7 "Désactiver") : un article inactif disparaît des listes de
    // sélection (catalogue, nouvelle commande, nouveau mouvement) mais reste lisible partout où il
    // apparaît déjà (commandes passées, mouvements de stock).
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    // Les colonnes "énumération" ci-dessus ne sont garanties par rien côté Postgres tant qu'elles
    // restent du `text` (choix volontaire pour rester simple à faire évoluer) — ces CHECK ferment
    // la porte à une valeur invalide insérée hors de l'application (script, migration manuelle).
    check('articles_level_check', sql`${table.level} in ('matiere_premiere','semi_fini','produit_fini')`),
    check('articles_unit_check', sql`${table.unit} in ('kg','m','rouleau','piece','panier','carton')`),
  ],
)

export const fournisseurs = pgTable('fournisseurs', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  country: text('country'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  paymentTerms: text('payment_terms'),
  leadTimeDays: integer('lead_time_days'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
})

export const catalogueProduits = pgTable('catalogue_produits', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id')
    .notNull()
    .unique()
    .references(() => articles.id, { onDelete: 'restrict' }),
  label: text('label').notNull(),
  finish: text('finish'),
  supplierRef: text('supplier_ref'),
  typicalNetWeightKg: doublePrecision('typical_net_weight_kg'),
  typicalLengthM: doublePrecision('typical_length_m'),
  usualPrice: doublePrecision('usual_price'),
  usualCurrency: text('usual_currency'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Commander (§5.2) et Recevoir (§5.3)
// ---------------------------------------------------------------------------

export const commandeEtats = ['brouillon', 'commandee', 'partiellement_recue', 'recue', 'soldee', 'annulee'] as const
export type CommandeEtat = (typeof commandeEtats)[number]

export const commandes = pgTable(
  'commandes',
  {
    id: serial('id').primaryKey(),
    numero: text('numero').notNull().unique(),
    fournisseurId: integer('fournisseur_id')
      .notNull()
      .references(() => fournisseurs.id, { onDelete: 'restrict' }),
    devise: text('devise').notNull(),
    tauxChange: doublePrecision('taux_change'),
    dateArriveePrevue: text('date_arrivee_prevue'),
    reference: text('reference'),
    commentaire: text('commentaire'),
    // Toujours déduit par le serveur (§5.2 : "jamais choisis à la main") — jamais écrit depuis une
    // valeur venant directement du formulaire de l'UI.
    etat: text('etat', { enum: commandeEtats }).notNull().default('brouillon'),
    ...timestamps,
  },
  (table) => [check('commandes_etat_check', sql`${table.etat} in ('brouillon','commandee','partiellement_recue','recue','soldee','annulee')`)],
)

export const commandeLignes = pgTable(
  'commande_lignes',
  {
    id: serial('id').primaryKey(),
    commandeId: integer('commande_id')
      .notNull()
      .references(() => commandes.id, { onDelete: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    catalogueProduitId: integer('catalogue_produit_id').references(() => catalogueProduits.id, { onDelete: 'set null' }),
    nomAffiche: text('nom_affiche').notNull(),
    description: text('description'),
    quantite: doublePrecision('quantite').notNull(),
    prixUnitaire: doublePrecision('prix_unitaire'),
    finish: text('finish'),
    ...timestamps,
  },
  (table) => [
    // §11 : une même ligne (article + finition) une seule fois par commande. `finish` peut être
    // NULL pour la plupart des articles — Postgres traite deux NULL comme non-égaux dans un
    // index unique, donc cette contrainte ne gêne que les lignes qui précisent réellement une
    // finition commune (les bobines).
    uniqueIndex('commande_lignes_unique_idx').on(table.commandeId, table.articleId, table.finish),
    index('commande_lignes_commande_idx').on(table.commandeId),
    check('commande_lignes_quantite_check', sql`${table.quantite} > 0`),
    check('commande_lignes_prix_check', sql`${table.prixUnitaire} is null or ${table.prixUnitaire} >= 0`),
  ],
)

export const receptions = pgTable('receptions', {
  id: serial('id').primaryKey(),
  commandeId: integer('commande_id')
    .notNull()
    .references(() => commandes.id, { onDelete: 'restrict' }),
  numero: text('numero').notNull().unique(),
  date: text('date').notNull(),
  referenceDocument: text('reference_document'),
  documentsConformes: boolean('documents_conformes').notNull().default(false),
  ...timestamps,
})

export const receptionLignes = pgTable(
  'reception_lignes',
  {
    id: serial('id').primaryKey(),
    receptionId: integer('reception_id')
      .notNull()
      .references(() => receptions.id, { onDelete: 'cascade' }),
    commandeLigneId: integer('commande_ligne_id')
      .notNull()
      .references(() => commandeLignes.id, { onDelete: 'restrict' }),
    quantiteRecue: doublePrecision('quantite_recue').notNull(),
    quantiteAcceptee: doublePrecision('quantite_acceptee').notNull(),
    motifEcart: text('motif_ecart'),
    ...timestamps,
  },
  (table) => [
    index('reception_lignes_reception_idx').on(table.receptionId),
    check('reception_lignes_quantite_recue_check', sql`${table.quantiteRecue} >= 0`),
    check('reception_lignes_quantite_acceptee_check', sql`${table.quantiteAcceptee} >= 0`),
  ],
)

// ---------------------------------------------------------------------------
// Stock (§5.4)
// ---------------------------------------------------------------------------

export const stockMouvementTypes = [
  'reception',
  'entree_manuelle',
  'entree_directe',
  'sortie_manuelle',
  'sortie_exceptionnelle',
  'ajustement',
  'inventaire',
  // Production (§5.5/§8) : tubes/cartons consommés par une fabrication, produit fini entrant en
  // stock depuis une fabrication ou un retour Doctor Rewinder, pertes définitives (traçabilité
  // seule — les pièces perdues n'ont jamais été mises en stock, donc `rebut` n'affecte aucun solde).
  'consommation',
  'transformation',
  'rebut',
  // Ventes (§10) : sortie de produit fini à la livraison — distincte de `sortie_manuelle` pour
  // qu'une sortie-vente se distingue clairement d'un ajustement manuel dans l'historique.
  'vente',
] as const
export type StockMouvementType = (typeof stockMouvementTypes)[number]

export const stockMouvements = pgTable(
  'stock_mouvements',
  {
    id: serial('id').primaryKey(),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    type: text('type', { enum: stockMouvementTypes }).notNull(),
    // Toujours positive — le `type` porte le sens (entrée/sortie), jamais un signe implicite.
    quantite: doublePrecision('quantite').notNull(),
    motif: text('motif'),
    auteurId: text('auteur_id').notNull(),
    auteurName: text('auteur_name').notNull(),
    receptionLigneId: integer('reception_ligne_id').references(() => receptionLignes.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    ...timestamps,
  },
  (table) => [
    index('stock_mouvements_article_idx').on(table.articleId),
    check(
      'stock_mouvements_type_check',
      sql`${table.type} in ('reception','entree_manuelle','entree_directe','sortie_manuelle','sortie_exceptionnelle','ajustement','inventaire','consommation','transformation','rebut','vente')`,
    ),
    check('stock_mouvements_quantite_check', sql`${table.quantite} > 0`),
  ],
)

// Cache dénormalisé du solde par article — toujours mis à jour dans la même transaction qu'un
// insert dans `stockMouvements` (§11 : "un stock n'est jamais modifié directement"). Jamais
// modifié ailleurs dans le code.
export const stockNiveaux = pgTable(
  'stock_niveaux',
  {
    articleId: integer('article_id')
      .primaryKey()
      .references(() => articles.id, { onDelete: 'cascade' }),
    quantite: doublePrecision('quantite').notNull().default(0),
    ...timestamps,
  },
  // La contrainte la plus utile de cette phase : empêche structurellement le cache de stock de
  // passer sous zéro, même en cas de futur bug de concurrence — pas seulement le garde-fou
  // applicatif déjà présent dans `insertStockMouvement`.
  (table) => [check('stock_niveaux_quantite_check', sql`${table.quantite} >= 0`)],
)

// ---------------------------------------------------------------------------
// Production (§5.5, §8) et Doctor Rewinder (§5.6)
// ---------------------------------------------------------------------------

export const modeleRubanFamilles = ['bopp', 'pvc_electrique', 'masquage'] as const
export type ModeleRubanFamille = (typeof modeleRubanFamilles)[number]

// Simplement modifiable pour l'instant (pas d'historique de versions — §12 "Production en
// version simple d'emblée"). `active` joue le même rôle de désactivation que pour
// Articles/Fournisseurs.
export const modelesRuban = pgTable(
  'modeles_ruban',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    famille: text('famille', { enum: modeleRubanFamilles }).notNull(),
    largeurMm: doublePrecision('largeur_mm').notNull(),
    longueurRouleauM: doublePrecision('longueur_rouleau_m').notNull(),
    piecesParTour: integer('pieces_par_tour').notNull(),
    piecesParCarton: integer('pieces_par_carton').notNull(),
    // Étape de groupage réelle (pièces regroupées en paquet puis filmées au plastique rétractable
    // avant la mise en carton) — nullable : c'est l'usine qui décide si/comment elle regroupe pour
    // chaque modèle, pas un chiffre figé dans le code. Tant que l'un des deux n'est pas renseigné,
    // aucune consommation de plastique n'est calculée pour ce modèle.
    piecesParPaquet: integer('pieces_par_paquet'),
    plastiqueKgParPaquet: doublePrecision('plastique_kg_par_paquet'),
    finish: text('finish'),
    moule: text('moule'),
    bobineArticleId: integer('bobine_article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    tubeArticleId: integer('tube_article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    cartonArticleId: integer('carton_article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    plastiqueArticleId: integer('plastique_article_id').references(() => articles.id, { onDelete: 'restrict' }),
    produitFiniArticleId: integer('produit_fini_article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    check('modeles_ruban_famille_check', sql`${table.famille} in ('bopp','pvc_electrique','masquage')`),
    check('modeles_ruban_largeur_check', sql`${table.largeurMm} > 0`),
    check('modeles_ruban_longueur_check', sql`${table.longueurRouleauM} > 0`),
    check('modeles_ruban_pieces_par_tour_check', sql`${table.piecesParTour} > 0`),
    check('modeles_ruban_pieces_par_carton_check', sql`${table.piecesParCarton} > 0`),
    check('modeles_ruban_pieces_par_paquet_check', sql`${table.piecesParPaquet} is null or ${table.piecesParPaquet} > 0`),
    check('modeles_ruban_plastique_kg_check', sql`${table.plastiqueKgParPaquet} is null or ${table.plastiqueKgParPaquet} > 0`),
  ],
)

export const fabricationEtats = ['ouverte', 'terminee', 'annulee'] as const
export type FabricationEtat = (typeof fabricationEtats)[number]

// Fusionne ordre + séance + résultat en une seule ligne : l'écran unique "+Nouvelle fabrication"
// → "Saisir le résultat" → "Terminer" (§5.5) ne distingue pas ces trois objets, donc on ne les
// sépare pas en base non plus. Les colonnes de résultat restent NULL tant que `etat = 'ouverte'`.
// Les valeurs calculées (§8 : pièces théoriques/brutes/conformes, cartons, écart, rendement) ne
// sont jamais stockées — toujours dérivées à la lecture pour ne jamais diverger du modèle.
export const fabrications = pgTable(
  'fabrications',
  {
    id: serial('id').primaryKey(),
    numero: text('numero').notNull().unique(),
    modeleRubanId: integer('modele_ruban_id')
      .notNull()
      .references(() => modelesRuban.id, { onDelete: 'restrict' }),
    metrageEngage: doublePrecision('metrage_engage').notNull(),
    dateDebut: text('date_debut').notNull(),
    etat: text('etat', { enum: fabricationEtats }).notNull().default('ouverte'),
    toursTotal: integer('tours_total'),
    toursDefectueux: integer('tours_defectueux'),
    piecesDefectueusesSupp: integer('pieces_defectueuses_supp'),
    piecesDoctorRewinder: integer('pieces_doctor_rewinder'),
    piecesPerdues: integer('pieces_perdues'),
    dateResultat: text('date_resultat'),
    ...timestamps,
  },
  (table) => [
    check('fabrications_etat_check', sql`${table.etat} in ('ouverte','terminee','annulee')`),
    check('fabrications_metrage_check', sql`${table.metrageEngage} > 0`),
  ],
)

export const doctorRewinderStatuts = ['en_cours', 'cloture'] as const
export type DoctorRewinderStatut = (typeof doctorRewinderStatuts)[number]

// Créé automatiquement par `enregistrerResultatFabrication` dès que `piecesDoctorRewinder > 0`
// (décision validée avec le client : pas de bouton "Envoyer" séparé, pour ne pas dupliquer la
// même saisie à deux endroits).
export const doctorRewinderDossiers = pgTable(
  'doctor_rewinder_dossiers',
  {
    id: serial('id').primaryKey(),
    fabricationId: integer('fabrication_id')
      .notNull()
      .references(() => fabrications.id, { onDelete: 'restrict' }),
    quantiteEnvoyee: integer('quantite_envoyee').notNull(),
    quantiteRecuperee: integer('quantite_recuperee'),
    quantitePerdue: integer('quantite_perdue'),
    dateEnvoi: text('date_envoi').notNull(),
    dateRetour: text('date_retour'),
    statut: text('statut', { enum: doctorRewinderStatuts }).notNull().default('en_cours'),
    ...timestamps,
  },
  (table) => [check('doctor_rewinder_dossiers_statut_check', sql`${table.statut} in ('en_cours','cloture')`)],
)

// ---------------------------------------------------------------------------
// Ventes (§10) : clients, commandes clients, livraisons, créances
// ---------------------------------------------------------------------------

// Même anatomie que `fournisseurs` : code déduit du nom, jamais supprimé — "Désactiver" seulement.
export const clients = pgTable(
  'clients',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    segment: text('segment'),
    zone: text('zone'),
    // Sert à calculer l'échéance d'une commande (dateCommande + delaiPaiementJours) pour détecter
    // les retards en Créances. NULL = pas d'échéance calculable pour ce client.
    delaiPaiementJours: integer('delai_paiement_jours'),
    // NULL = pas de plafond, jamais de blocage pour ce client. Montant GNF entier.
    plafondEncours: gnf('plafond_encours'),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [check('clients_plafond_check', sql`${table.plafondEncours} is null or ${table.plafondEncours} >= 0`)],
)

export const commandeClientEtats = ['brouillon', 'confirmee', 'partiellement_livree', 'livree', 'annulee'] as const
export type CommandeClientEtat = (typeof commandeClientEtats)[number]

export const commandesClients = pgTable(
  'commandes_clients',
  {
    id: serial('id').primaryKey(),
    numero: text('numero').notNull().unique(),
    clientId: integer('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    // §10 : les ventes de terrain sont saisies par le directeur commercial lui-même (les
    // commerciaux n'ont pas de compte) — ce champ optionnel trace qui a réalisé la vente, sans
    // dupliquer ce formulaire en un second écran "vente de terrain".
    commercial: text('commercial'),
    dateCommande: text('date_commande').notNull(),
    reference: text('reference'),
    commentaire: text('commentaire'),
    // Toujours déduit par le serveur, jamais choisi à la main — même convention que `commandes.etat`.
    etat: text('etat', { enum: commandeClientEtats }).notNull().default('brouillon'),
    ...timestamps,
  },
  (table) => [check('commandes_clients_etat_check', sql`${table.etat} in ('brouillon','confirmee','partiellement_livree','livree','annulee')`)],
)

export const commandesClientsLignes = pgTable(
  'commandes_clients_lignes',
  {
    id: serial('id').primaryKey(),
    commandeClientId: integer('commande_client_id')
      .notNull()
      .references(() => commandesClients.id, { onDelete: 'cascade' }),
    // Doit être un article de niveau `produit_fini` — validé en mutation, pas en contrainte DB
    // (même choix que `commandeLignes.articleId` côté achats).
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    nomAffiche: text('nom_affiche').notNull(),
    quantite: doublePrecision('quantite').notNull(),
    // Prix de vente en GNF entier.
    prixUnitaire: gnf('prix_unitaire').notNull(),
    ...timestamps,
  },
  (table) => [
    index('commandes_clients_lignes_commande_idx').on(table.commandeClientId),
    check('commandes_clients_lignes_quantite_check', sql`${table.quantite} > 0`),
    check('commandes_clients_lignes_prix_check', sql`${table.prixUnitaire} >= 0`),
  ],
)

export const livraisonsClients = pgTable('livraisons_clients', {
  id: serial('id').primaryKey(),
  commandeClientId: integer('commande_client_id')
    .notNull()
    .references(() => commandesClients.id, { onDelete: 'restrict' }),
  numero: text('numero').notNull().unique(),
  date: text('date').notNull(),
  ...timestamps,
})

export const livraisonsClientsLignes = pgTable(
  'livraisons_clients_lignes',
  {
    id: serial('id').primaryKey(),
    livraisonId: integer('livraison_id')
      .notNull()
      .references(() => livraisonsClients.id, { onDelete: 'cascade' }),
    commandeClientLigneId: integer('commande_client_ligne_id')
      .notNull()
      .references(() => commandesClientsLignes.id, { onDelete: 'restrict' }),
    quantiteLivree: doublePrecision('quantite_livree').notNull(),
    ...timestamps,
  },
  (table) => [
    index('livraisons_clients_lignes_livraison_idx').on(table.livraisonId),
    check('livraisons_clients_lignes_quantite_check', sql`${table.quantiteLivree} > 0`),
  ],
)

export const paiementsClients = pgTable(
  'paiements_clients',
  {
    id: serial('id').primaryKey(),
    commandeClientId: integer('commande_client_id')
      .notNull()
      .references(() => commandesClients.id, { onDelete: 'restrict' }),
    montant: gnf('montant').notNull(),
    methode: text('methode').notNull(),
    date: text('date').notNull(),
    ...timestamps,
  },
  (table) => [index('paiements_clients_commande_idx').on(table.commandeClientId), check('paiements_clients_montant_check', sql`${table.montant} > 0`)],
)

// Un seul prix courant par (client, article) — pas d'historique de versions (même esprit que
// `modelesRuban` : "simplement modifiable"). Sert uniquement à préremplir le prix d'une nouvelle
// commande ; le prix reste toujours modifiable à la main.
export const tarifsClients = pgTable(
  'tarifs_clients',
  {
    id: serial('id').primaryKey(),
    clientId: integer('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    prixUnitaire: gnf('prix_unitaire').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('tarifs_clients_unique_idx').on(table.clientId, table.articleId),
    check('tarifs_clients_prix_check', sql`${table.prixUnitaire} >= 0`),
  ],
)

// Devis (§10) : une proposition commerciale qui peut être acceptée (→ devient une commande
// client) ou refusée. Pas d'état "envoyé" séparé — même simplification que `commandesClients`
// où `brouillon` couvre déjà "en attente de réponse du client".
export const devisEtats = ['brouillon', 'accepte', 'refuse'] as const
export type DevisEtat = (typeof devisEtats)[number]

export const devis = pgTable(
  'devis',
  {
    id: serial('id').primaryKey(),
    numero: text('numero').notNull().unique(),
    clientId: integer('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    commercial: text('commercial'),
    dateDevis: text('date_devis').notNull(),
    // Nullable = pas d'expiration calculée pour ce devis. Jamais stocké comme état : dérivé à la
    // lecture (dateDevis + validiteJours < aujourd'hui), même principe que `enRetard` des créances.
    validiteJours: integer('validite_jours'),
    reference: text('reference'),
    commentaire: text('commentaire'),
    etat: text('etat', { enum: devisEtats }).notNull().default('brouillon'),
    // Renseigné uniquement à l'acceptation — trace la commande créée à partir de ce devis.
    commandeClientId: integer('commande_client_id').references(() => commandesClients.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    check('devis_etat_check', sql`${table.etat} in ('brouillon','accepte','refuse')`),
    check('devis_validite_check', sql`${table.validiteJours} is null or ${table.validiteJours} > 0`),
  ],
)

export const devisLignes = pgTable(
  'devis_lignes',
  {
    id: serial('id').primaryKey(),
    devisId: integer('devis_id')
      .notNull()
      .references(() => devis.id, { onDelete: 'cascade' }),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'restrict' }),
    nomAffiche: text('nom_affiche').notNull(),
    quantite: doublePrecision('quantite').notNull(),
    prixUnitaire: gnf('prix_unitaire').notNull(),
    ...timestamps,
  },
  (table) => [
    index('devis_lignes_devis_idx').on(table.devisId),
    check('devis_lignes_quantite_check', sql`${table.quantite} > 0`),
    check('devis_lignes_prix_check', sql`${table.prixUnitaire} >= 0`),
  ],
)

// Relances créances (§10) : journal append-only — jamais modifié ni supprimé, c'est lui-même
// l'historique. Aucun envoi réel (pas d'intégration SMS/email) : le niveau est calculé
// automatiquement à la lecture (cf. `NIVEAU_RELANCE_SEUILS` dans lib/db/queries/ventes.ts), le
// commercial contacte le client lui-même puis enregistre ici ce qu'il a fait.
export const relancesClients = pgTable(
  'relances_clients',
  {
    id: serial('id').primaryKey(),
    commandeClientId: integer('commande_client_id')
      .notNull()
      .references(() => commandesClients.id, { onDelete: 'restrict' }),
    niveau: integer('niveau').notNull(),
    canal: text('canal').notNull(),
    commentaire: text('commentaire'),
    date: text('date').notNull(),
    auteurId: text('auteur_id').notNull(),
    auteurName: text('auteur_name').notNull(),
    ...timestamps,
  },
  (table) => [
    index('relances_clients_commande_idx').on(table.commandeClientId),
    check('relances_clients_niveau_check', sql`${table.niveau} in (1,2,3)`),
  ],
)

// ---------------------------------------------------------------------------
// Journal d'audit (append-only, générique — pattern BILMS)
// ---------------------------------------------------------------------------

export const auditLogActions = ['update', 'delete'] as const

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    action: text('action', { enum: auditLogActions }).notNull(),
    // Pas de FK vers `user` (auth-schema.ts) — évite un cycle d'import entre schema.ts et
    // auth-schema.ts, même pattern que BILMS.
    actorId: text('actor_id').notNull(),
    actorName: text('actor_name').notNull(),
    reason: text('reason'),
    beforeData: jsonb('before_data').notNull(),
    afterData: jsonb('after_data'),
    ...timestamps,
  },
  (table) => [index('audit_log_entity_idx').on(table.entityType, table.entityId)],
)

// ---------------------------------------------------------------------------
// Relations (déclarées pour les entités réellement interrogées relationnellement)
// ---------------------------------------------------------------------------

export const articlesRelations = relations(articles, ({ many, one }) => ({
  catalogueProduit: one(catalogueProduits),
  mouvements: many(stockMouvements),
}))

export const commandesRelations = relations(commandes, ({ one, many }) => ({
  fournisseur: one(fournisseurs, { fields: [commandes.fournisseurId], references: [fournisseurs.id] }),
  lignes: many(commandeLignes),
  receptions: many(receptions),
}))

export const commandeLignesRelations = relations(commandeLignes, ({ one, many }) => ({
  commande: one(commandes, { fields: [commandeLignes.commandeId], references: [commandes.id] }),
  article: one(articles, { fields: [commandeLignes.articleId], references: [articles.id] }),
  receptionLignes: many(receptionLignes),
}))

export const receptionsRelations = relations(receptions, ({ one, many }) => ({
  commande: one(commandes, { fields: [receptions.commandeId], references: [commandes.id] }),
  lignes: many(receptionLignes),
}))

export const receptionLignesRelations = relations(receptionLignes, ({ one }) => ({
  reception: one(receptions, { fields: [receptionLignes.receptionId], references: [receptions.id] }),
  commandeLigne: one(commandeLignes, { fields: [receptionLignes.commandeLigneId], references: [commandeLignes.id] }),
}))

export const fabricationsRelations = relations(fabrications, ({ one, many }) => ({
  modeleRuban: one(modelesRuban, { fields: [fabrications.modeleRubanId], references: [modelesRuban.id] }),
  doctorRewinderDossiers: many(doctorRewinderDossiers),
}))

export const doctorRewinderDossiersRelations = relations(doctorRewinderDossiers, ({ one }) => ({
  fabrication: one(fabrications, { fields: [doctorRewinderDossiers.fabricationId], references: [fabrications.id] }),
}))

export const commandesClientsRelations = relations(commandesClients, ({ one, many }) => ({
  client: one(clients, { fields: [commandesClients.clientId], references: [clients.id] }),
  lignes: many(commandesClientsLignes),
  livraisons: many(livraisonsClients),
  paiements: many(paiementsClients),
}))

export const commandesClientsLignesRelations = relations(commandesClientsLignes, ({ one, many }) => ({
  commandeClient: one(commandesClients, { fields: [commandesClientsLignes.commandeClientId], references: [commandesClients.id] }),
  article: one(articles, { fields: [commandesClientsLignes.articleId], references: [articles.id] }),
  livraisonsLignes: many(livraisonsClientsLignes),
}))

export const livraisonsClientsRelations = relations(livraisonsClients, ({ one, many }) => ({
  commandeClient: one(commandesClients, { fields: [livraisonsClients.commandeClientId], references: [commandesClients.id] }),
  lignes: many(livraisonsClientsLignes),
}))

export const livraisonsClientsLignesRelations = relations(livraisonsClientsLignes, ({ one }) => ({
  livraison: one(livraisonsClients, { fields: [livraisonsClientsLignes.livraisonId], references: [livraisonsClients.id] }),
  commandeClientLigne: one(commandesClientsLignes, { fields: [livraisonsClientsLignes.commandeClientLigneId], references: [commandesClientsLignes.id] }),
}))

export const devisRelations = relations(devis, ({ one, many }) => ({
  client: one(clients, { fields: [devis.clientId], references: [clients.id] }),
  commandeClient: one(commandesClients, { fields: [devis.commandeClientId], references: [commandesClients.id] }),
  lignes: many(devisLignes),
}))

export const devisLignesRelations = relations(devisLignes, ({ one }) => ({
  devis: one(devis, { fields: [devisLignes.devisId], references: [devis.id] }),
  article: one(articles, { fields: [devisLignes.articleId], references: [articles.id] }),
}))

export const relancesClientsRelations = relations(relancesClients, ({ one }) => ({
  commandeClient: one(commandesClients, { fields: [relancesClients.commandeClientId], references: [commandesClients.id] }),
}))

export const tarifsClientsRelations = relations(tarifsClients, ({ one }) => ({
  client: one(clients, { fields: [tarifsClients.clientId], references: [clients.id] }),
  article: one(articles, { fields: [tarifsClients.articleId], references: [articles.id] }),
}))

// ---------------------------------------------------------------------------
// RH (§9) : fiche employé — V1 volontairement limitée à l'identification/au poste, sans salaires
// ni pointage ni congés (hors périmètre de cette itération). Jamais de suppression, comme partout
// ailleurs : un employé qui part est désactivé, pas effacé (il peut rester référencé plus tard).
// ---------------------------------------------------------------------------

export const employes = pgTable('employes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  poste: text('poste').notNull(),
  phone: text('phone'),
  email: text('email'),
  dateEmbauche: text('date_embauche'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
})
