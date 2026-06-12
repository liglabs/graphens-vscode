import * as vscode from 'vscode'
import { ChatViewProvider } from './ChatViewProvider'
import { graphensResponder } from './participant/graphensResponder'
import { startBlockedTracker } from './proactiveNotifications/blockedTracker'
import logger from './logger'

export function activate(context: vscode.ExtensionContext) {
  logger.info('Activating Graphens')
  const provider = new ChatViewProvider(context)
  vscode.chat.createChatParticipant('graphens-ai.tutor', graphensResponder)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, provider),
    startBlockedTracker()
  )
}

export function deactivate() {}
