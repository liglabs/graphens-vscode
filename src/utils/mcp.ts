import * as vscode from 'vscode';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import logger from '../logger';

const toolSep = '____'

// --- Schema ---

const StdioServerSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const SseServerSchema = z.object({
  type: z.enum(['sse', 'http']),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const ServerConfigSchema = z.union([
  SseServerSchema,
  StdioServerSchema,
]);

const McpJsonSchema = z.object({
  mcpServers: z.record(z.string(), ServerConfigSchema).optional(),
  servers: z.record(z.string(), ServerConfigSchema).optional(),
});

type ServerConfig = z.infer<typeof ServerConfigSchema>;

// --- Public types ---

export interface McpToolClient {
  serverName: string;
  client: Client;
  tools: vscode.LanguageModelChatTool[];
}

// --- Main function ---

export async function initMcpClients(
  context: vscode.ExtensionContext
): Promise<McpToolClient[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    console.warn('[Graphens] No workspace folder open, skipping MCP init');
    return [];
  }

  const mcpJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, '.graphens', 'mcp.json');

  // Read file
  let parsed: unknown;
  try {
    const raw = await vscode.workspace.fs.readFile(mcpJsonUri);
    parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
  } catch {
    logger.warn('[Graphens] No .graphens/mcp.json found, skipping MCP init');
    return [];
  }

  // Validate schema
  const result = McpJsonSchema.safeParse(parsed);
  if (!result.success) {
    vscode.window.showErrorMessage(
      `[Graphens] Invalid .graphens/mcp.json:\n${result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`
    );
    return [];
  }

  const servers = result.data.mcpServers ?? result.data.servers ?? {};
  if (Object.keys(servers).length === 0) {
    console.log('[Graphens] No servers defined in .graphens/mcp.json');
    return [];
  }

  // Connect each server
  const clients: McpToolClient[] = [];

  for (const [name, config] of Object.entries(servers)) {
    try {
      const client = new Client({ name, version: '0' });

      if ('url' in config) {
        await client.connect(new SSEClientTransport(new URL(config.url)));
      } else {
        await client.connect(new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
        }));
      }

      const { tools: mcpTools } = await client.listTools();
      const chatTools: vscode.LanguageModelChatTool[] = mcpTools.map(t => ({
        name: `${name}${toolSep}${t.name}`,
        description: t.description ?? '',
        inputSchema: t.inputSchema as object,
      }));

      clients.push({ serverName: name, client, tools: chatTools });
      logger.debug(`"${name}" connected — ${chatTools.length} tool(s): ${chatTools.map(t => t.name).join(', ')}`);

      context.subscriptions.push({ dispose: () => client.close() });
    } catch (err) {
      vscode.window.showWarningMessage(`[Graphens] Failed to connect MCP server "${name}": ${err}`);
    }
  }

  return clients;
}

// --- Helper to invoke a tool by name ---

export async function callMcpTool(
  clients: McpToolClient[],
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const [server, tool] = toolName.split(toolSep, 2)
  if (!server || !tool) throw new Error(`[Graphens] Error exctracting MCP metadata from "${toolName}"`)

  const owner = clients.find(c => c.serverName === server);
  if (!owner) throw new Error(`[Graphens] No MCP client with name "${server}" for tool "${toolName}"`);

  const result = await owner.client.callTool({ name: tool, arguments: input });

  return (result.content as Array<{ type: string; text: string }>)
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
}