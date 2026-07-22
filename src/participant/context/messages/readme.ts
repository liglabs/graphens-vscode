import * as vscode from 'vscode'
import { getReadme } from 'graphens-vscode-shared'

export async function getReadmeContextMessage(): Promise<string>{
  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
  const readme = await getReadme(projectRoot)
  if (readme)
    return `Voici le contenu du README.md trouvé dans l'espace de travail :\n\n${readme}`
  return "Aucun fichier README.md trouvé dans l'espace de travail."
}