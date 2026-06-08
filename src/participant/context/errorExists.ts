import * as vscode from 'vscode'

const ERROR_DETECTION_TOOL: vscode.LanguageModelChatTool = {
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

export async function errorExists(
  model: vscode.LanguageModelChat,
  userPrompt: string,
  token: vscode.CancellationToken
): Promise<boolean> {
  const messages = [
    vscode.LanguageModelChatMessage.User(
      `You are a programming assistant classifier. Determine whether the following user message indicates they are facing or asking about a compilation, type-checking, or build error in their project.\n\n` +
      `User message:\n"""\n${userPrompt}\n"""\n\n` +
      `Use the report_error_exists tool to report your finding.`
    )
  ]

  const response = await model.sendRequest(
    messages,
    { tools: [ERROR_DETECTION_TOOL], toolMode: vscode.LanguageModelChatToolMode.Required },
    token
  )

  for await (const part of response.stream) {
    if (part instanceof vscode.LanguageModelToolCallPart && part.name === ERROR_DETECTION_TOOL.name) {
      const input = part.input as { hasErrors?: boolean }
      return input.hasErrors ?? false
    }
  }

  return false
}
