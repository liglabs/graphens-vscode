import * as vscode from 'vscode'
import { McpToolClient, callMcpTool, encodeToolName } from '../../../utils/mcp'
import logger from '../../../logger';

export async function chooseAndCallMcp(
  model: vscode.LanguageModelChat,
  clients: McpToolClient[],
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken
): Promise<string[]> {
  const tools = clients.flatMap(c => c.tools.map(t => ({
    ...t,
    name: encodeToolName(c.serverName, t.name)
  })));

  const response = await model.sendRequest(messages, { 
    tools,
    justification: 'Choose MCP tools for calling' 
  }, token);

  const toolCalls: vscode.LanguageModelToolCallPart[] = [];
  for await (const part of response.stream) {
    if (part instanceof vscode.LanguageModelToolCallPart) {
      toolCalls.push(part);
    }
  }

  logger.debug(`[Graphens] LM chose ${toolCalls.length} tool(s): ${toolCalls.map(t => t.name).join(', ')}`);

  return Promise.all(
    toolCalls.map(call =>
      callMcpTool(clients, call.name, call.input as Record<string, unknown>)
    )
  );
}