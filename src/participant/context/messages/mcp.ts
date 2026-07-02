import * as vscode from 'vscode'
import { McpToolClient } from '../../../utils/mcp'
import { ParticipantContext } from '../../../models/ParticipantContext'
import { chooseAndCallMcp } from '../utils/chooseAndCallMcp'

export async function getMcpContextMessages(
  ctx: ParticipantContext,
  clientsPromise: Promise<McpToolClient[]>,
  messages: vscode.LanguageModelChatMessage[],
): Promise<string[]>{
  const clients = await clientsPromise
  return chooseAndCallMcp(ctx.request.model, clients, messages, ctx.token)
}