import {z} from 'zod'

export const HistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
})

export const NormalResponseMetadataSchema = z.object({
  prompt: z.string(),
  model: z.string(),
  sessionId: z.string(),
  context: z.object({
    readme: z.string(),
    graphens: z.string(),
    workspace: z.string(),
    errors: z.array(z.string()),
    files: z.array(z.string()),
    mcp: z.array(z.string())
  }),
  history: HistoryMessageSchema.array(),
  response: z.string()
})

export const CheatingResponseMetadataSchema = z.object({
  prompt: z.string(),
  model: z.string(),
  sessionId: z.string(),
  cheatingGuard: z.boolean(),
  history: HistoryMessageSchema.array()
})

export const CommandResponseMetadataSchema = z.object({
  command: z.string()
})

export const ResponseMetadataSchema = z.union([
  NormalResponseMetadataSchema,
  CheatingResponseMetadataSchema,
  CommandResponseMetadataSchema
])

export type ResponseMetadata = z.output<typeof ResponseMetadataSchema>