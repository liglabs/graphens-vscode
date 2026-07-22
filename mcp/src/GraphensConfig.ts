import { z } from 'zod'

/**
 * Represents the expected schema of the graphens config located in .graphens/config.yaml
 */
export const BlockersDetectorConfigSchema = z.object({
  period: z.number().int().positive().optional(),
  radius: z.number().int().positive().optional()
}).partial()

export type BlockersDetectorConfig = z.infer<typeof BlockersDetectorConfigSchema>

/**
 * Represents the expected schema of the graphens config located in .graphens/config.yaml
 */
export const GraphensConfigSchema = z.object({
  ue: z.coerce.string(),
  cours: z.string(),
  tp_name: z.string(),
  sources: z.string().url().array(),
  blockers_detector: z.union([
    z.boolean(),
    BlockersDetectorConfigSchema
  ])
}).partial()

/**
 * Represents the expected type of the graphens config located in .graphens/config.yaml
 */
export type GraphensConfig = z.output<typeof GraphensConfigSchema>
