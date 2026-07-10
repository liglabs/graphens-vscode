import * as vscode from 'vscode'
import * as path from 'path'
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
  const graphens = new GraphensParticipant(context)
  const participant = vscode.chat.createChatParticipant(configStatic.participantId, graphens.responde)

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  const projectRoot = workspaceFolder ? workspaceFolder.uri.fsPath : ''
  const workspaceMcpPath = path.join(context.extensionPath, 'mcp', 'dist', 'index.mjs')

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, provider),
    startBlockedTracker(),
    participant.onDidReceiveFeedback(graphens.handleFeedback),
    vscode.lm.registerMcpServerDefinitionProvider('graphens-workspace-mcp', {
      provideMcpServerDefinitions() {
        return [
          new vscode.McpStdioServerDefinition(
            'Graphens Workspace MCP',
            'node',
            [workspaceMcpPath, projectRoot]
          )
        ]
      }
    })
  )
}

export function deactivate() {}
