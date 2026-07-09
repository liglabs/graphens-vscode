import { getReadme } from '../utils/getReadme'

export async function getReadmeContextMessage(): Promise<string>{
  const readme = await getReadme()
  if (readme)
    return `Voici le contenu du README.md trouvé dans l'espace de travail :\n\n${readme}`
  return "Aucun fichier README.md trouvé dans l'espace de travail."
}