import {z} from 'zod'

export const GraphensConfigSchema = z.object({
  sources: z.url().array()
}).partial()

export type GraphensConfig = z.output<typeof GraphensConfigSchema>