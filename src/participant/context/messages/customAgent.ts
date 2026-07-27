import * as vscode from 'vscode'
import * as fs from 'fs/promises'
import * as path from 'path'

export async function getCustomAgentPrompt(): Promise<string | null> {
  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!projectRoot) {
    return null
  }
  const customAgentPath = path.join(projectRoot, '.graphens', 'agent.md')
  try {
    const content = await fs.readFile(customAgentPath, 'utf-8')
    return content
  } catch (error) {
    return null
  }
}
