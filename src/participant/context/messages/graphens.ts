import * as vscode from 'vscode'
import { getGraphensFiles } from '../utils/getGraphensFiles'
import { getGraphensSources, GraphensSourceSchema } from '../utils/getGraphensSources'
import type { SessionCache } from '../../../utils/SessionCache'

export async function getGraphensContextMessage(cache: SessionCache, onConfigError: (e:Error)=>void): Promise<vscode.LanguageModelChatMessage>{  
  const [
    localFiles,
    remoteFiles
  ] = await Promise.all([
    getGraphensFiles(),
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
  return vscode.LanguageModelChatMessage.User(promptParts.join("\n\n====================\n\n"))



  async function getGraphensSourcesCached() {
    const cached = await cache.get('graphens.remote', GraphensSourceSchema.array())
    if (cached) {
      return cached
    }
    const response = getGraphensSources(onConfigError)
    await cache.set('graphens.remote', response)
    return response
  }
}