// Interrupteur du cahier des charges §2.1 : en développement, personne n'est bloqué par un
// circuit de validation — celui qui saisit peut tout exécuter directement. Ce plan (Socle →
// Stock) n'implémente encore aucun circuit de validation (§9) ; l'interrupteur est posé dès
// maintenant pour que ce circuit puisse être branché plus tard sans refonte des mutations.
export const VALIDATIONS_ACTIVES = process.env.VALIDATIONS_ACTIVES === 'true'

// Double authentification (§3) : désactivée en développement, comme les validations.
export const DOUBLE_AUTH_ACTIVE = process.env.DOUBLE_AUTH_ACTIVE === 'true'
