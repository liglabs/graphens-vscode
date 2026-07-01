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
import { initMcpClients, McpToolClient } from '../utils/mcp'
import { getMcpContextMessages } from './context/messages/mcp'
import logger from '../logger'

export class GraphensParticipant {
  private mcpClientsPromise: Promise<McpToolClient[]>
  constructor(
    private extentionContext: vscode.ExtensionContext
  ) {
    this.mcpClientsPromise = initMcpClients(extentionContext)
  }

  public responde: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<void> => {
    console.log('Graphens responding to : ', request.prompt)
    const ctx: ParticipantContext = { request, context, stream, token }

    switch (request.prompt) {
      case 'list_mcp':
        const clients = await this.mcpClientsPromise
        logger.info(clients)
        stream.markdown('MCPs chargés :\n')
        for (const client of clients) {
          stream.markdown(`- ${client.serverName} : ${client.tools.map(t => t.name).join(', ')}\n`)
        }
        return
      case 'reload_mcp':
        this.mcpClientsPromise = initMcpClients(this.extentionContext)
        stream.markdown('MCPs rechargés')
        return
    }

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
      mcpContext
    ] = await Promise.all([
      getReadmeContextMessage(),
      getGraphensContextMessage(cache, (e) => stream.markdown('$(error) Erreur en lisant `.graphens/config.yaml` pour charger les fichiers du course')),
      getWorkspaceContextMessage(),
      getErrorsContextMessages(ctx, cache),
      getFilesContextMessage(request.prompt, cache),
      getMcpContextMessages(ctx, this.mcpClientsPromise, [vscode.LanguageModelChatMessage.User(request.prompt)])
    ])

    stream.progress('Génération de la réponse…')

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(BASE_PROMPT),
      readmeContext,
      graphensContext,
      workspaceContext,
      ...errorsContext,
      ...filesContext,
      ...mcpContext
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
