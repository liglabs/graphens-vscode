import * as vscode from 'vscode'
import BASE_PROMPT from '../BASE_PROMPT.md?raw'
import {getReadme} from './context/getReadme.js'
import {getGraphensFiles} from './context/getGraphensFiles.js'

export const graphensResponder: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> => {
  if (request.command === 'debug_readme') {
    const readme = await getReadme()
    if (readme === '') {
      return stream.markdown('No README.md file found in the workspace.')
    }
    return stream.markdown(readme)
  } else if (request.command === 'debug_graphens_files') {
    const files = await getGraphensFiles()
    if (files.length === 0) {
      return stream.markdown('No .graphens markdown files found in the workspace.')
    }
    for (const file of files) {
      stream.markdown(`### ${file.name}\n\n${file.content}`)
    }
    return
  }

  const [readme, graphensFiles] = await Promise.all([
    getReadme(),
    getGraphensFiles()
  ])

  const prompt = [
    BASE_PROMPT,
    readme 
      ? `Voici le contenu du README.md trouvé dans l'espace de travail :\n\n${readme}` 
      : 'Aucun fichier README.md trouvé dans l\'espace de travail.',
    'Voici la liste des fichiers .graphens markdown trouvés dans l\'espace de travail :\n\n',
    ...graphensFiles.map(file => `---\ntitle: ${file.name}\n---\n${file.content}`)
  ].join('\n\n ============ \n\n')

  const messages = [vscode.LanguageModelChatMessage.User(prompt)];
  messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

  const chatResponse = await request.model.sendRequest(messages, {}, token);

  for await (const fragment of chatResponse.text) {
    stream.markdown(fragment);
  }
};