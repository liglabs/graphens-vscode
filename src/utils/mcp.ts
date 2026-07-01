import * as vscode from 'vscode';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import logger from '../logger';
import * as os from 'os';
import path from 'path';


const toolSep = '____'
const isWindows = os.platform() === 'win32'

logger.info('Platform:', os.platform(), 'isWindows:', isWindows);

const nodeExecutablePath = process.execPath;
const nodeDir = path.dirname(nodeExecutablePath);
const currentPath = process.env.PATH || '';
const effectivePath = `${nodeDir}${path.delimiter}${currentPath}`;

const childEnv = {
  ...process.env,
  PATH: effectivePath
};


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
  logger.debug('MCP JSON URI:', mcpJsonUri?.toString());
  if (!mcpJsonUri) return [];

  const raw = await readMcpJson(mcpJsonUri);
  logger.debug('MCP JSON raw content:', raw);
  if (!raw) return [];

  const servers = parseMcpJson(raw);
  logger.debug('Parsed MCP servers:', servers);
  if (!servers) return [];

  return connectAllServers(context, servers);
}


// --- Helper to invoke a tool by name ---

export function encodeToolName(server: string, tool: string): string {
  return `${server}${toolSep}${tool}`.replace(/\./g, '-_-dot-_-');
}

export function decodeToolName(encoded: string): { server: string; tool: string } {
  const [server, tool] = encoded.replace(/-_-dot-_-/g, '.').split(toolSep, 2);
  if (!server || !tool) {
    throw new Error(`[Graphens] Error decoding tool name "${encoded}"`);
  }
  return { server, tool };
}


export async function callMcpTool(
  clients: McpToolClient[],
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  logger.debug('Attemting to call MCP tool:', toolName, 'with input:', input);
  const { server, tool } = decodeToolName(toolName);

  const owner = clients.find(c => c.serverName === server);
  if (!owner)
    throw new Error(`[Graphens] No MCP client with name "${server}" for tool "${toolName}"`);

  logger.debug(`Calling MCP tool "${tool}" on server "${server}" with input:`, input);
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


async function connectServer(
  context: vscode.ExtensionContext,
  name: string,
  config: ServerConfig
): Promise<Client | null> {
  if ('url' in config) {
    const sseTransport = new SSEClientTransport(new URL(config.url))
    const httpTransport = new StreamableHTTPClientTransport(new URL(config.url))
    const [sseConnected, httpConnected] = await Promise.allSettled(
      [sseTransport, httpTransport].map(async (t) => {
        const c = new Client({ name, version: '0' })
        await c.connect(t)
        return c
      }),
    )
    if (!sseConnected || !httpConnected) {
      return null
    }
    if (sseConnected.status === 'rejected' && httpConnected.status === 'rejected') {
      logger.error(sseConnected.reason)
      logger.error(httpConnected.reason)
      vscode.window.showWarningMessage(
        `[Graphens] Failed to connect MCP server "${name}": SSE - ${sseConnected.reason}, HTTP - ${httpConnected.reason}`
      );
      return null;
    }
    if (sseConnected.status === 'fulfilled') {
      context.subscriptions.push({ dispose: () => sseConnected.value.close() });
      return sseConnected.value
    };
    if (httpConnected.status === 'fulfilled') {
      context.subscriptions.push({ dispose: () => httpConnected.value.close() });
      return httpConnected.value;
    }
    return null
  }
  const stdioTransport = new StdioClientTransport({
    command: isWindows ? 'cmd' : config.command,
    args: isWindows ? ['/c', config.command, ...(config.args ?? [])] : config.args ?? [],
    env: { ...childEnv, ...(config.env ?? {}) } as Record<string, string>,
  });
  const client = new Client({ name, version: '0' });
  try {
    await client.connect(stdioTransport);
    context.subscriptions.push({ dispose: () => client.close() });
    return client;
  } catch (err) {
    logger.error(err)
    vscode.window.showWarningMessage(
      `[Graphens] Failed to connect MCP server "${name}": ${err}`
    );
    return null;
  }
}


async function listTools(
  name: string,
  client: Client
): Promise<McpToolClient | null> {
  try {
    const { tools: mcpTools } = await client.listTools();
    const tools: vscode.LanguageModelChatTool[] = mcpTools.map(t => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema as object,
    }))
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
    Object.entries(servers).map(async ([name, config]) => {
      const client = await connectServer(context, name, config);
      if (!client) return null;
      return listTools(name, client);
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<McpToolClient> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value);
}