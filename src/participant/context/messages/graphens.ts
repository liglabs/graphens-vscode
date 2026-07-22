import * as vscode from 'vscode'
import { getGraphensFiles, getGraphensSources, GraphensSourceSchema } from 'graphens-vscode-shared'
import type { SessionCache } from '../../../utils/SessionCache'

export async function getGraphensContextMessage(cache: SessionCache, onConfigError: (e:Error)=>void): Promise<string>{  
  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
  const [
    localFiles,
    remoteFiles
  ] = await Promise.all([
    getGraphensFiles(projectRoot),
    getGraphensSourcesCached()
  ])

  const promptParts = [
    "Voici les instructions personnalisées pour l'IA",
    ...localFiles.map(
      (file) => `---\ntitle: ${file.name}\n---\n${file.content}`,
    ),
    ...remoteFiles.map(
      (file) => `---\ntitle: ${file.url}\n---\n${file.content}`,
    ),
  ]
  return promptParts.join("\n\n====================\n\n")



  async function getGraphensSourcesCached() {
    const cached = await cache.get('graphens.remote', GraphensSourceSchema.array())
    if (cached) {
      return cached
    }
    const response = await getGraphensSources(projectRoot, onConfigError)
    await cache.set('graphens.remote', response)
    return response
  }
}