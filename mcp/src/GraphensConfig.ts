import { z } from 'zod'

/**
 * Represents the expected schema of the graphens config located in .graphens/config.yaml
 */
export const GraphensConfigSchema = z.object({
  ue: z.coerce.string(),
  cours: z.string(),
  tp_name: z.string(),
  mcp_tools: z.string().array(),
  sources: z.string().url().array()
}).partial()

/**
 * Represents the expected type of the graphens config located in .graphens/config.yaml
 */
export type GraphensConfig = z.output<typeof GraphensConfigSchema>
