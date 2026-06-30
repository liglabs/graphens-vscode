import * as vscode from 'vscode';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import logger from '../logger';


const toolSep = '____';


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


const ServerConfigSchema = z.union([SseServerSchema, StdioServerSchema]);
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
  const mcpJsonUri = resolveWorkspaceMcpUri(context);
  if (!mcpJsonUri) return [];

  const raw = await readMcpJson(mcpJsonUri);
  if (!raw) return [];

  const servers = parseMcpJson(raw);
  if (!servers) return [];

  return connectAllServers(context, servers);
}


// --- Helper to invoke a tool by name ---


export async function callMcpTool(
  clients: McpToolClient[],
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const [server, tool] = toolName.split(toolSep, 2);
  if (!server || !tool)
    throw new Error(`[Graphens] Error extracting MCP metadata from "${toolName}"`);

  const owner = clients.find(c => c.serverName === server);
  if (!owner)
    throw new Error(`[Graphens] No MCP client with name "${server}" for tool "${toolName}"`);

  const result = await owner.client.callTool({ name: tool, arguments: input });

  return (result.content as Array<{ type: string; text: string }>)
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
}

function resolveWorkspaceMcpUri(
  context: vscode.ExtensionContext
): vscode.Uri | null {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.warn('[Graphens] No workspace folder open, skipping MCP init');
    return null;
  }
  return vscode.Uri.joinPath(workspaceFolder.uri, '.graphens', 'mcp.json');
}


async function readMcpJson(uri: vscode.Uri): Promise<unknown | null> {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(raw).toString('utf-8'));
  } catch {
    logger.warn('[Graphens] No .graphens/mcp.json found, skipping MCP init');
    return null;
  }
}


function parseMcpJson(
  parsed: unknown
): Record<string, ServerConfig> | null {
  const result = McpJsonSchema.safeParse(parsed);
  if (!result.success) {
    vscode.window.showErrorMessage(
      `[Graphens] Invalid .graphens/mcp.json:\n${result.error.issues
        .map(i => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`
    );
    return null;
  }

  const servers = result.data.mcpServers ?? result.data.servers ?? {};
  if (Object.keys(servers).length === 0) {
    logger.debug('[Graphens] No servers defined in .graphens/mcp.json');
    return null;
  }

  return servers;
}


function buildTransport(config: ServerConfig) {
  if ('url' in config) {
    return new SSEClientTransport(new URL(config.url));
  }
  return new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
  });
}


async function connectServer(
  context: vscode.ExtensionContext,
  name: string,
  config: ServerConfig
): Promise<McpToolClient | null> {
  try {
    const client = new Client({ name, version: '0' });
    await client.connect(buildTransport(config));

    const { tools: mcpTools } = await client.listTools();
    const tools: vscode.LanguageModelChatTool[] = mcpTools.map(t => ({
      name: `${name}${toolSep}${t.name}`,
      description: t.description ?? '',
      inputSchema: t.inputSchema as object,
    }));

    context.subscriptions.push({ dispose: () => client.close() });
    logger.debug(`"${name}" connected — ${tools.length} tool(s): ${tools.map(t => t.name).join(', ')}`);

    return { serverName: name, client, tools };
  } catch (err) {
    vscode.window.showWarningMessage(
      `[Graphens] Failed to connect MCP server "${name}": ${err}`
    );
    return null;
  }
}


async function connectAllServers(
  context: vscode.ExtensionContext,
  servers: Record<string, ServerConfig>
): Promise<McpToolClient[]> {
  const results = await Promise.allSettled(
    Object.entries(servers).map(([name, config]) =>
      connectServer(context, name, config)
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<McpToolClient> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value);
}