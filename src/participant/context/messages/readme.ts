import * as vscode from 'vscode'
import { getReadme } from '../utils/getReadme'

export async function getReadmeContextMessage(): Promise<vscode.LanguageModelChatMessage>{
  const readme = await getReadme()
  if (readme)
    return vscode.LanguageModelChatMessage.User(`Voici le contenu du README.md trouvé dans l'espace de travail :\n\n${readme}`)
  return vscode.LanguageModelChatMessage.User("Aucun fichier README.md trouvé dans l'espace de travail.")
}