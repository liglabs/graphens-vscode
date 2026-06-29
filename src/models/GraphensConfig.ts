import {z} from 'zod'

/**
 * Represents the expected schema of the graphens config located in .graphens/config.yaml
 */
export const GraphensConfigSchema = z.object({
  mcp_tools: z.string().array(),
  sources: z.url().array()
}).partial()

/**
 * Represents the expected type of the graphens config located in .graphens/config.yaml
 */
export type GraphensConfig = z.output<typeof GraphensConfigSchema>