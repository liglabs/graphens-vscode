import * as vscode from 'vscode'
import { ChatViewProvider } from './ChatViewProvider'

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, provider)
  )
}

export function deactivate() {}
