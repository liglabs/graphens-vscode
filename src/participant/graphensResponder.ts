import * as vscode from 'vscode'
import BASE_PROMPT from '../messages/BASE_PROMPT.md?raw'
import RESPONSE_TO_CHEATER from '../messages/RESPONSE_TO_CHEATER.md?raw'
import {getReadme} from './context/getReadme.js'
import {getGraphensFiles} from './context/getGraphensFiles.js'
import { runCompiler } from './context/runCompiler'
import { getOpenFiles } from './context/getOpenFiles'
import { getHighlightedCode } from './context/getHighlightedCode'
import { getHistory } from './context/getHistory'
import { isCheating } from './guards/cheating'
import { errorExists } from './context/errorExists'
import { getLanguageServerErrors } from './context/getLanguageServerErrors'
import { RagService } from '../utils/rag'
import logger from '../logger'
import { getCourseContent } from './context/getCourseContent'
import { getFilesByLink } from './context/getFilesByLink'
import { getGraphensConfig } from './context/getGraphensConfig'
import { getGraphensSources } from './context/getGraphensSources'
import ReadGraphensConfigError from '../errors/ReadGraphensConfigError'

export const graphensResponder: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> => {
  console.log('Graphens responding to : ', request.prompt)

  switch (request.command) {
    case 'debug_readme':{
      const readme = await getReadme()
      if (readme === '') {
        return stream.markdown('No README.md file found in the workspace.')
      }
      return stream.markdown(readme)
    }
    case 'debug_open_files': {
      const openFiles = await getOpenFiles()
      if (openFiles.length === 0) {
        return stream.markdown('No open files found.')
      }
      for (const file of openFiles) {
        stream.markdown(`### ${file.path}\n\n${file.content}\n\n`)
      }
      return
    }
    case 'debug_graphens_files': {
      const files = await getGraphensFiles()
      if (files.length === 0) {
        return stream.markdown('No .graphens markdown files found in the workspace.')
      }
      for (const file of files) {
        stream.markdown(`### ${file.name}\n\n${file.content}\n\n`)
      }
      return
    }
    case 'debug_highlighted_code': {
      const highlightedCode = await getHighlightedCode()
      if (!highlightedCode) {
        return stream.markdown('No highlighted code found.')
      }
      stream.markdown(`Voici le code mis en évidence dans l\'éditeur : \n\n`)
      return stream.markdown(`\`\`\`json\n${JSON.stringify(highlightedCode, null, 2)}\n\`\`\``)
    }
    case 'debug_cheating_guard': {
      const isCheater = await isCheating(request.prompt, request.model, token)
      return stream.markdown(`Cheating guard result: ${isCheater ? 'Cheater detected' : 'No cheating detected'}`)
    }
    case 'debug_history': {
      const history = getHistory(context)
      if (history.length === 0) {
        return stream.markdown('No chat history found.')
      }
      logger.info(context.history)
      logger.info(history)
      for (const message of history) {
        stream.markdown(`### ${message.role}\n\n${message.content.join('')}\n\n`)
      }
      return
    }
    case 'debug_compiler': {
      const compilerOutput = await runCompiler(request.model, getHistory(context), token)
      return stream.markdown(`**Compile command:** \`${compilerOutput.command}\`\n\nCompiler output: \n\`\`\`shell\n${compilerOutput.output}\n\`\`\``)
    }
    case 'debug_language_server_errors': {
      const errors = await getLanguageServerErrors()
      if (errors.length === 0) {
        return stream.markdown('No language server diagnostics found for the active file.')
      }
      return stream.markdown(`\`\`\`json\n${JSON.stringify(errors, null, 2)}\n\`\`\``)
    }
    case 'debug_rag': {
      logger.info(request.prompt)
      const response = await getCourseContent(request.prompt)
      logger.info(response)
      return stream.markdown('Fetched')
    }
    case 'debug_mentioned_files': {
      const files = await getFilesByLink(request.prompt)
      logger.info('Mentioned files : ', files)
      return stream.markdown('Fetched files are in the console')
    }
    case "debug_graphens_config": {
      const config = await getGraphensConfig()
      logger.info(config)
      return stream.markdown('Config is in logs')
    }
    case "debug_graphens_sources": {
      logger.info('Sources: ', await getGraphensSources())
      return stream.markdown("Sources are in logs")
    }
  }

  const history = getHistory(context)

  const cheatingResponseSent = history
    .some(message => message.role === vscode.LanguageModelChatMessageRole.Assistant && message.content.toString() === RESPONSE_TO_CHEATER)

  if (cheatingResponseSent || await isCheating(request.prompt, request.model, token)) {
    stream.markdown(RESPONSE_TO_CHEATER)
    return
  }

  const [
    readme, 
    graphensFiles, 
    graphensSources,
    openFiles, 
    highlightedCode, 
    languageServerErrors, 
    compilerOutput, 
    courseContent,
    mentionedFiles
  ] = await Promise.all([
    getReadme(),
    getGraphensFiles(),
    (async () => {
      try {
        return await getGraphensSources()
      } catch {
        stream.progress('Erreur en lisant .graphens/config.yaml')
        return []
      }
    })(),
    getOpenFiles(),
    getHighlightedCode(),
    getLanguageServerErrors(),
    (async () => {
      if (!(await errorExists(request.model, request.prompt, token)))
        return null
      return runCompiler(request.model, getHistory(context), token)
    })(),
    getCourseContent(request.prompt),
    getFilesByLink(request.prompt)
  ])

  const prompt = [
    BASE_PROMPT,
    readme 
      ? `Voici le contenu du README.md trouvé dans l'espace de travail :\n\n${readme}` 
      : 'Aucun fichier README.md trouvé dans l\'espace de travail.',
    'Voici la liste des fichiers .graphens markdown trouvés dans l\'espace de travail :\n\n',
    ...graphensFiles.map(file => `---\ntitle: ${file.name}\n---\n${file.content}`),
    ...graphensSources.map(file => `---\ntitle: ${file.url}\n---\n${file.content}`),
    'Voici le contenu de tous les fichiers ouverts dans l\'éditeur :\n\n',
    ...openFiles.map(file => `### ${file.path}\n\n${file.content}`),
    'Voici le contenu du cours pertinent: \n\n',
    ...courseContent.map(chunk => `## ${chunk.titre} \n\n ${chunk.texte}`),
    'Voici les fichiers mentionnés par l\'étudiant',
    ...mentionedFiles.map(file => `### ${file.original}\n\n${file.content}`),
    highlightedCode 
      ? `Voici le code mis en évidence dans l\'éditeur (${highlightedCode.filename}[${highlightedCode.linesRange[0]}-${highlightedCode.linesRange[1]}]) :\n\n${highlightedCode.content}` 
      : 'Aucun code mis en évidence trouvé.',
    languageServerErrors.length > 0
      ? `Voici les erreurs du serveur de langage pour le fichier actif :\n\n\`\`\`json\n${JSON.stringify(languageServerErrors, null, 2)}\n\`\`\``
      : 'Aucune erreur de serveur de langage détectée dans le fichier actif.',
    compilerOutput
      ? `Voici le résultat de la tentative de compilation du projet :\n\n**Compile command:** \`${compilerOutput.command}\`\n\n **Success:** ${compilerOutput.success}\n\nCompiler output: \n\`\`\`shell\n${compilerOutput.output}\n\`\`\``
      : 'Aucune erreur de compilation détectée ou aucune commande de compilation suggérée.'
  ].join('\n\n ============ \n\n')

  const messages = [vscode.LanguageModelChatMessage.User(prompt)];
  messages.push(...history);
  messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

  const chatResponse = await request.model.sendRequest(messages, {}, token);

  for await (const fragment of chatResponse.text) {
    stream.markdown(fragment);
  }
};