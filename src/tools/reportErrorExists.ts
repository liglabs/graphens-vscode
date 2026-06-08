import * as vscode from 'vscode'
import { z } from 'zod'

export const reportErrorExistsSchema = z.object({
  hasErrors: z.boolean()
})

export type ReportErrorExistsInput = z.infer<typeof reportErrorExistsSchema>

export const reportErrorExistsTool: vscode.LanguageModelChatTool = {
  name: 'report_error_exists',
  description: 'Report whether the user is describing or asking about a compilation/type error in their project',
  inputSchema: {
    type: 'object' as const,
    properties: {
      hasErrors: {
        type: 'boolean',
        description: 'true if the user prompt indicates they are facing or asking about a compilation, type, or build error'
      }
    },
    required: ['hasErrors']
  }
}
