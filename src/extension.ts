import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
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

  const packageJsonPath = path.join(context.extensionPath, 'package.json')
  let extensionVersion = '0.6.2'
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (pkg.version) {
      extensionVersion = pkg.version
    }
  } catch (error) {
    logger.error('Failed to read extension version from package.json:', error)
  }

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
            [workspaceMcpPath, projectRoot],
            {},
            extensionVersion
          )
        ]
      }
    })
  )
}

export function deactivate() {}
