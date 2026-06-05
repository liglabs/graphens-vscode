import * as vscode from 'vscode'
import { ChatViewProvider } from './ChatViewProvider'
import { graphensResponder } from './participant/graphensResponder'

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context)
  vscode.chat.createChatParticipant('graphens-ai.tutor', graphensResponder)

  context.subscriptions.push(
    // vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, provider),
    // vscode.commands.registerCommand('graphens-ai.clearChat', () => provider.clearChat())
  )
}

export function deactivate() {}
