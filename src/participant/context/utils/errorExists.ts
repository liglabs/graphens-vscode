import * as vscode from 'vscode'
import { reportErrorExistsTool, reportErrorExistsSchema } from '../../../tools/reportErrorExists'
import { parseToolCallFromStream } from '../../../utils/parseToolCall'
import { CompilerResult } from './runCompiler'

export async function errorExists(
  model: vscode.LanguageModelChat,
  userPrompt: string,
  token: vscode.CancellationToken,
  latestCompilerOutput?: CompilerResult
): Promise<boolean> {
  const messages = [
    vscode.LanguageModelChatMessage.User(
      `You are a programming assistant classifier. Determine whether the following user message indicates they are facing or asking about a compilation, type-checking, or build error in their project.\n\n` +
      `User message:\n"""\n${userPrompt}\n"""\n\n` +
      `Use the report_error_exists tool to report your finding.`
    )
  ]

  if (latestCompilerOutput) {
    messages.push(vscode.LanguageModelChatMessage.User(
      'There is latest compiler output started via (it can be old and irrelevant, but sometimes you can save time on not running compilation):\n\n' +
      `**Command**: \`${latestCompilerOutput.command}\`\n\n` +
      `**Success**: \`${latestCompilerOutput.success}\`\n\n` +
      '```shell\n' +
      latestCompilerOutput.output + 
      '\n```'
    ))
  }

  const response = await model.sendRequest(
    messages,
    { tools: [reportErrorExistsTool], toolMode: vscode.LanguageModelChatToolMode.Required },
    token
  )

  const result = await parseToolCallFromStream(response, reportErrorExistsTool.name, reportErrorExistsSchema)
  return result?.hasErrors ?? false
}
