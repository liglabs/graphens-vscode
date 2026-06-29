import * as vscode from 'vscode'
import { ChatViewProvider } from './ChatViewProvider'
import { GraphensParticipant } from './participant/GraphensParticipant'
import { startBlockedTracker } from './proactiveNotifications/blockedTracker'
import logger from './logger'
import configStatic from './config.static'
import { initMcpClients } from './utils/mcp'

export async function activate(context: vscode.ExtensionContext) {
  logger.info('Activating Graphens')
  const mcpClients = await initMcpClients(context);
  const provider = new ChatViewProvider(context)
  const participant = new GraphensParticipant(context, mcpClients)
  vscode.chat.createChatParticipant(configStatic.participantId, participant.responde)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, provider),
    startBlockedTracker()
  )
}

export function deactivate() {}
