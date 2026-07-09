import { getOpenFiles } from '../utils/getOpenFiles'
import { getHighlightedCode } from '../utils/getHighlightedCode'

export async function getWorkspaceContextMessage(): Promise<string>{
  const [
    openFiles,
    highlightedCode
  ] = await Promise.all([
    getOpenFiles(),
    getHighlightedCode()
  ])
  const messageParts = []
  if (highlightedCode) {
    messageParts.push(`Voici le code mis en évidence dans l\'éditeur (${highlightedCode.filename}[${highlightedCode.linesRange[0]}-${highlightedCode.linesRange[1]}]) :\n\n${highlightedCode.content}`)
  }
  messageParts.push("Voici le contenu de tous les fichiers ouverts dans l'éditeur :")
  messageParts.push(...openFiles.map((file) => `### ${file.path}\n\n${file.content}`))
  return messageParts.join('\n\n====================\n\n')
}