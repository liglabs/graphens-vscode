import * as vscode from 'vscode'
import BASE_PROMPT from '../messages/BASE_PROMPT.md?raw'
import RESPONSE_TO_CHEATER from '../messages/RESPONSE_TO_CHEATER.md?raw'
import { getHistory } from './context/utils/getHistory'
import { isCheating } from './guards/cheating'
import { processDebugCommands } from '../utils/processDebugCommands'
import { getSessionKey } from '../utils/getSessionKey'
import { SessionCache } from '../utils/SessionCache'
import { getReadmeContextMessage } from './context/messages/readme'
import { getGraphensContextMessage } from './context/messages/graphens'
import { getWorkspaceContextMessage } from './context/messages/workspace'
import { ParticipantContext } from '../models/ParticipantContext'
import { getErrorsContextMessages } from './context/messages/errors'
import { getFilesContextMessage } from './context/messages/files'
import { getMcpTools } from './context/utils/getMcpTools'
import { McpToolClient } from '../utils/mcp'

export class GraphensParticipant {
  constructor(
    private extentionContext: vscode.ExtensionContext,
    private mcpClients: McpToolClient[]
  ) {}

  public responde: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<void> => {
    console.log('Graphens responding to : ', request.prompt)
    const ctx: ParticipantContext = { request, context, stream, token }

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
      filesContext,
    ] = await Promise.all([
      getReadmeContextMessage(),
      getGraphensContextMessage(cache, (e) => stream.markdown('$(error) Erreur en lisant `.graphens/config.yaml` pour charger les fichiers du course')),
      getWorkspaceContextMessage(),
      getErrorsContextMessages(ctx, cache),
      getFilesContextMessage(request.prompt, cache),
    ])

    stream.progress('Génération de la réponse…')

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(BASE_PROMPT),
      readmeContext,
      graphensContext,
      workspaceContext,
      ...errorsContext,
      ...filesContext
    ]
    messages.push(...history)
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt))

    const chatResponse = await request.model.sendRequest(messages, {
      toolMode: vscode.LanguageModelChatToolMode.Auto,
      tools: await getMcpTools(() => stream.markdown('$(error) Erreur en lisant `.graphens/config.yaml` pour charger les MCP')),
      justification: 'Generate a human-readable answer'
    }, token)

    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment)
    }
  }
}
