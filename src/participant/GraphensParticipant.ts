import * as vscode from 'vscode'
import BASE_PROMPT from '../messages/BASE_PROMPT.md?raw'
import RESPONSE_TO_CHEATER from '../messages/RESPONSE_TO_CHEATER.md?raw'
import { getHistory, histoyToMessages } from './context/utils/getHistory'
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
  ): Promise<vscode.ChatResult> => {
    console.log('Graphens responding to : ', request.prompt)
    const ctx: ParticipantContext = { request, context, stream, token }

    switch (request.command) {
      case 'list_mcp':
        stream.progress('Chargement des MCPs…')
        const clients = await this.mcpClientsPromise
        logger.info(clients)
        stream.markdown('MCPs chargés :\n')
        for (const client of clients) {
          stream.markdown(`- ${client.serverName} : \n`)
          for (const tool of client.tools) {
            stream.markdown(`  - ${tool.name}\n`)
          }
        }
        return {
          metadata: {
            command: 'list_mcp'
          }
        }
      case 'reload_mcp':
        this.mcpClientsPromise = initMcpClients(this.extentionContext)
        stream.markdown('MCPs rechargés')
        return {
          metadata: {
            command: 'reload_mcp'
          }
        }
    }

    if (await processDebugCommands(request, context, stream, token)) {
      return {
        metadata: {
          command: request.command
        }
      }
    }

    const sessionId = getSessionKey(request, context)
    const cache = new SessionCache(this.extentionContext, sessionId)
    const history = getHistory(context)

    const cheatingResponseSent = history.some(
      (message) =>
        message.role === 'assistant' &&
        message.content === RESPONSE_TO_CHEATER,
    )

    if (
      cheatingResponseSent ||
      (await isCheating(request.prompt, request.model, token))
    ) {
      stream.markdown(RESPONSE_TO_CHEATER)
      return {
        metadata: {
          prompt: request.prompt,
          model: request.model.name,
          sessionId,
          cheatingGuard: true,
          history
        }
      }
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
      BASE_PROMPT,
      readmeContext,
      graphensContext,
      workspaceContext,
      ...errorsContext,
      ...filesContext,
      ...mcpContext
    ].map((content) => vscode.LanguageModelChatMessage.User(content))
    messages.push(...histoyToMessages(history))
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt))

    const chatResponse = await request.model.sendRequest(messages, {
      toolMode: vscode.LanguageModelChatToolMode.Auto,
      tools: await getMcpTools(() => stream.markdown('$(error) Erreur en lisant `.graphens/config.yaml` pour charger les MCP')),
      justification: 'Generate a human-readable answer'
    }, token)

    const responseFragments = []

    for await (const fragment of chatResponse.text) {
      responseFragments.push(fragment)
      stream.markdown(fragment)
    }

    return {
      metadata: {
        prompt: request.prompt,
        model: request.model.name,
        sessionId,
        context: {
          readme: readmeContext,
          graphens: graphensContext,
          workspace: workspaceContext,
          errors: errorsContext,
          files: filesContext,
          mcp: mcpContext
        },
        history,
        response: responseFragments.join('')
      }
    } as vscode.ChatResult
  }

  public handleFeedback = async (feedback: vscode.ChatResultFeedback) => {
    logger.debug('Feedback details:', feedback.result)
    switch (feedback.kind) {
      case vscode.ChatResultFeedbackKind.Helpful:
        logger.info('Feedback: Helpful')
        break
      case vscode.ChatResultFeedbackKind.Unhelpful:
        logger.info('Feedback: Not Helpful')
        break
    }
  }
}
