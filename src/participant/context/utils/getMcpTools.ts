import * as vscode from 'vscode'
import { getGraphensConfig } from 'graphens-vscode-mcp'

export async function getMcpTools(onConfigError?: (e: Error)=>void) {
  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
  const config = await getGraphensConfig(projectRoot, onConfigError)
  if (!config?.mcp_tools) return []
  return config.mcp_tools
    .map((t: string) => vscode.lm.tools.find(tool => tool.name === t))
    .filter((t): t is vscode.LanguageModelToolInformation => !!t)
}