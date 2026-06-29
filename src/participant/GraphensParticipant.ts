import * as vscode from 'vscode'
import BASE_PROMPT from '../messages/BASE_PROMPT.md?raw'
import RESPONSE_TO_CHEATER from '../messages/RESPONSE_TO_CHEATER.md?raw'
import { getHistory } from './context/utils/getHistory'
import { isCheating } from './guards/cheating'
import { getCourseContent } from './context/utils/getCourseContent'
import { getFilesByLink } from './context/utils/getFilesByLink'
import { processDebugCommands } from '../utils/processDebugCommands'
import { getSessionKey } from '../utils/getSessionKey'
import { SessionCache } from '../utils/SessionCache'
import { getReadmeContextMessage } from './context/messages/readme'
import { getGraphensContextMessage } from './context/messages/graphens'
import { getWorkspaceContextMessage } from './context/messages/workspace'
import { ParticipantContext } from '../models/ParticipantContext'
import { getErrorsContextMessages } from './context/messages/errors'

export class GraphensParticipant {
  constructor(private extentionContext: vscode.ExtensionContext) {}

  public responde: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<void> => {
    console.log('Graphens responding to : ', request.prompt)
    const ctx: ParticipantContext = {request, context, stream, token}

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
      readmeContext,
      graphensContext,
      workspaceContext,
      errorsContext,
      courseContent,
      mentionedFiles,
    ] = await Promise.all([
      getReadmeContextMessage(),
      getGraphensContextMessage(cache, (e) => stream.markdown('$(error) Erreur en lisant `.graphens/config.yaml`')),
      getWorkspaceContextMessage(),
      getErrorsContextMessages(ctx, cache),
      getCourseContent(request.prompt),
      getFilesByLink(request.prompt),
    ])

    const prompt = [
      'Voici le contenu du cours pertinent: \n\n',
      ...courseContent.map((chunk) => `## ${chunk.titre} \n\n ${chunk.texte}`),
      "Voici les fichiers mentionnés par l'étudiant",
      ...mentionedFiles.map(
        (file) => `### ${file.original}\n\n${file.content}`,
      )
    ].join('\n\n ============ \n\n')

    stream.progress('Génération de la réponse…')

    const messages = [
      vscode.LanguageModelChatMessage.User(BASE_PROMPT),
      readmeContext,
      graphensContext,
      workspaceContext,
      ...errorsContext
    ]
    messages.push(...history)
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt))

    const chatResponse = await request.model.sendRequest(messages, {}, token)

    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment)
    }
  }
}
