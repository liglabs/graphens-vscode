import { z } from 'zod'

/**
 * Represents the expected schema of the blockers detector sub-configuration.
 */
export const BlockersDetectorConfigSchema = z.object({
  period: z.number().int().min(1).max(1440).optional().describe("Période d'analyse (en minutes) pour détecter si un étudiant est bloqué (Défaut: 5)"),
  radius: z.number().int().min(0).max(1000).optional().describe("Rayon d'analyse en nombre de lignes. Si les modifications restent dans ce rayon, l'étudiant est considéré sur le même problème (Défaut: 10)")
})

export type BlockersDetectorConfig = z.infer<typeof BlockersDetectorConfigSchema>

/**
 * Represents the expected schema of the graphens config located in .graphens/config.yaml / config.yml / config.json
 */
export const GraphensConfigSchema = z.object({
  ue: z.coerce.string().describe("Identifiant unique de l'Unité d'Enseignement (ex: INF101)"),
  cours: z.string().describe("Nom abrégé ou complet du cours associé"),
  tp_name: z.string().describe("Nom de la séance de TP courante"),
  sources: z.string().url().array().describe("Liste des URLs distantes contenant les instructions ou le cours pour le RAG"),
  blockers_detector: z.union([
    z.boolean(),
    BlockersDetectorConfigSchema
  ]).describe("Configuration ou activation du détecteur automatique de blocage d'étudiants (Blocked Tracker)")
}).partial()

/**
 * Represents the expected type of the graphens config
 */
export type GraphensConfig = z.output<typeof GraphensConfigSchema>
