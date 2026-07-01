import * as vscode from 'vscode'
import { McpToolClient } from '../../../utils/mcp'
import { ParticipantContext } from '../../../models/ParticipantContext'
import { chooseAndCallMcp } from '../utils/chooseAndCallMcp'

export async function getMcpContextMessages(
  ctx: ParticipantContext,
  clientsPromise: Promise<McpToolClient[]>,
  messages: vscode.LanguageModelChatMessage[],
): Promise<vscode.LanguageModelChatMessage[]>{
  const clients = await clientsPromise
  const results = await chooseAndCallMcp(ctx.request.model, clients, messages, ctx.token)
  return results.map(r => vscode.LanguageModelChatMessage.User(r))
}