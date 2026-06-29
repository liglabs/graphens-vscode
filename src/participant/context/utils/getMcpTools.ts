import * as vscode from 'vscode'
import { getGraphensConfig } from "./getGraphensConfig"

export async function getMcpTools(onConfigError?: (e: Error)=>void) {
  const config = await getGraphensConfig(onConfigError)
  if (!config?.mcp_tools) return []
  return config.mcp_tools
    .map(t => vscode.lm.tools.find(tool => tool.name === t))
    .filter(t => !!t)
}