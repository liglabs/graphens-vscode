import * as vscode from 'vscode'
import { reportErrorExistsTool, reportErrorExistsSchema } from '../../../tools/reportErrorExists'
import { parseToolCallFromStream } from '../../../utils/parseToolCall'

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
    { tools: [reportErrorExistsTool], toolMode: vscode.LanguageModelChatToolMode.Required },
    token
  )

  const result = await parseToolCallFromStream(response, reportErrorExistsTool.name, reportErrorExistsSchema)
  return result?.hasErrors ?? false
}
