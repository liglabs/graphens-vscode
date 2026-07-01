import * as vscode from 'vscode'
import { ChatViewProvider } from './ChatViewProvider'
import { GraphensParticipant } from './participant/GraphensParticipant'
import { startBlockedTracker } from './proactiveNotifications/blockedTracker'
import logger from './logger'
import configStatic from './config.static'
import { LogLevels } from 'consola'

export async function activate(context: vscode.ExtensionContext) {
  logger.info('Extension Mode:', context.extensionMode)
  if (context.extensionMode !== vscode.ExtensionMode.Production) {
    logger.options.level = LogLevels.debug
  }
  logger.info('Activating Graphens')
  const provider = new ChatViewProvider(context)
  const participant = new GraphensParticipant(context)
  vscode.chat.createChatParticipant(configStatic.participantId, participant.responde)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, provider),
    startBlockedTracker()
  )
}

export function deactivate() {}
