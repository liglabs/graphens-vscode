import * as vscode from 'vscode'
import { z } from 'zod'

export const reportCompileCommandSchema = z.object({
  command: z.string(),
  reason: z.string().optional()
})

export type ReportCompileCommandInput = z.infer<typeof reportCompileCommandSchema>

export const reportCompileCommandTool: vscode.LanguageModelChatTool = {
  name: 'report_compile_command',
  description: 'Report the shell command to compile or type-check the project to detect errors',
  inputSchema: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to run (e.g. "npx tsc --noEmit", "mvn compile", "python -m py_compile src/main.py")'
      },
      reason: {
        type: 'string',
        description: 'One-sentence explanation of why this command was chosen'
      }
    },
    required: ['command']
  }
}
