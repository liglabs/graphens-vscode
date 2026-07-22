import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { ChatViewProvider } from './ChatViewProvider'
import { GraphensParticipant } from './participant/GraphensParticipant'
import { startBlockedTracker } from './proactiveNotifications/blockedTracker'
import { getGraphensConfig } from 'graphens-vscode-mcp'
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


  const mcpVersionPath = path.join(context.extensionPath, 'mcp', 'dist', 'version.json')
  let mcpVersion = 'undefined'
  try {
    const versionInfo = JSON.parse(fs.readFileSync(mcpVersionPath, 'utf8'))
    if (versionInfo.version) {
      mcpVersion = versionInfo.version
    }
  } catch (error) {
    logger.error('Failed to read MCP version from version.json, falling back to extension version:', error)
  }

  const config = await getGraphensConfig(projectRoot)
  if (config && config.blockers_detector) {
    const trackerConfig = typeof config.blockers_detector === 'object' ? config.blockers_detector : {}
    context.subscriptions.push(startBlockedTracker(trackerConfig))
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, provider),
    participant.onDidReceiveFeedback(graphens.handleFeedback),
    vscode.lm.registerMcpServerDefinitionProvider('graphens-workspace-mcp', {
      provideMcpServerDefinitions() {
        return [
          new vscode.McpStdioServerDefinition(
            'Graphens Workspace MCP',
            'node',
            [workspaceMcpPath, projectRoot],
            {},
            mcpVersion
          )
        ]
      }
    })
  )
}

export function deactivate() {}
