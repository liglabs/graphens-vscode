import * as vscode from 'vscode'
import BASE_PROMPT from '../messages/BASE_PROMPT.md?raw'
import RESPONSE_TO_CHEATER from '../messages/RESPONSE_TO_CHEATER.md?raw'
import { getReadme } from './context/utils/getReadme.js'
import { getGraphensFiles } from './context/utils/getGraphensFiles.js'
import { runCompiler } from './context/utils/runCompiler'
import { getOpenFiles } from './context/utils/getOpenFiles'
import { getHighlightedCode } from './context/utils/getHighlightedCode'
import { getHistory } from './context/utils/getHistory'
import { isCheating } from './guards/cheating'
import { errorExists } from './context/utils/errorExists'
import { getLanguageServerErrors } from './context/utils/getLanguageServerErrors'
import { getCourseContent } from './context/utils/getCourseContent'
import { getFilesByLink } from './context/utils/getFilesByLink'
import { getGraphensSources } from './context/utils/getGraphensSources'
import { processDebugCommands } from '../utils/processDebugCommands'
import { getSessionKey } from '../utils/getSessionKey'
import { SessionCache } from '../utils/SessionCache'

export class GraphensParticipant {
  constructor(private extentionContext: vscode.ExtensionContext) {}

  public responde: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<void> => {
    console.log('Graphens responding to : ', request.prompt)

    if (await processDebugCommands(request, context, stream, token)) {
      return
    }

    const sessionId = getSessionKey(request, context)
    const cache = new SessionCache(this.extentionContext, sessionId)
    const history = getHistory(context)

    const cheatingResponseSent = history.some(
      (message) =>
        message.role === vscode.LanguageModelChatMessageRole.Assistant &&
        message.content.toString() === RESPONSE_TO_CHEATER,
    )

    if (
      cheatingResponseSent ||
      (await isCheating(request.prompt, request.model, token))
    ) {
      stream.markdown(RESPONSE_TO_CHEATER)
      return
    }

    stream.progress('Chargement du contexte…')

    const [
      readme,
      graphensFiles,
      graphensSources,
      openFiles,
      highlightedCode,
      languageServerErrors,
      compilerOutput,
      courseContent,
      mentionedFiles,
    ] = await Promise.all([
      getReadme(),
      getGraphensFiles(),
      (async () => {
        try {
          return await getGraphensSources()
        } catch {
          stream.markdown('$(error) Erreur en lisant `.graphens/config.yaml`')
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
      getFilesByLink(request.prompt),
    ])

    const prompt = [
      BASE_PROMPT,
      readme
        ? `Voici le contenu du README.md trouvé dans l'espace de travail :\n\n${readme}`
        : "Aucun fichier README.md trouvé dans l'espace de travail.",
      "Voici la liste des fichiers .graphens markdown trouvés dans l'espace de travail :\n\n",
      ...graphensFiles.map(
        (file) => `---\ntitle: ${file.name}\n---\n${file.content}`,
      ),
      ...graphensSources.map(
        (file) => `---\ntitle: ${file.url}\n---\n${file.content}`,
      ),
      "Voici le contenu de tous les fichiers ouverts dans l'éditeur :\n\n",
      ...openFiles.map((file) => `### ${file.path}\n\n${file.content}`),
      'Voici le contenu du cours pertinent: \n\n',
      ...courseContent.map((chunk) => `## ${chunk.titre} \n\n ${chunk.texte}`),
      "Voici les fichiers mentionnés par l'étudiant",
      ...mentionedFiles.map(
        (file) => `### ${file.original}\n\n${file.content}`,
      ),
      highlightedCode
        ? `Voici le code mis en évidence dans l\'éditeur (${highlightedCode.filename}[${highlightedCode.linesRange[0]}-${highlightedCode.linesRange[1]}]) :\n\n${highlightedCode.content}`
        : 'Aucun code mis en évidence trouvé.',
      languageServerErrors.length > 0
        ? `Voici les erreurs du serveur de langage pour le fichier actif :\n\n\`\`\`json\n${JSON.stringify(languageServerErrors, null, 2)}\n\`\`\``
        : 'Aucune erreur de serveur de langage détectée dans le fichier actif.',
      compilerOutput
        ? `Voici le résultat de la tentative de compilation du projet :\n\n**Compile command:** \`${compilerOutput.command}\`\n\n **Success:** ${compilerOutput.success}\n\nCompiler output: \n\`\`\`shell\n${compilerOutput.output}\n\`\`\``
        : 'Aucune erreur de compilation détectée ou aucune commande de compilation suggérée.',
    ].join('\n\n ============ \n\n')

    stream.progress('Génération de la réponse…')

    const messages = [vscode.LanguageModelChatMessage.User(prompt)]
    messages.push(...history)
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt))

    const chatResponse = await request.model.sendRequest(messages, {}, token)

    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment)
    }
  }
}
