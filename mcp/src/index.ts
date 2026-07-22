import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getReadme,
  getGraphensConfig,
  getGraphensFiles,
  getGraphensSources
} from 'graphens-vscode-shared'

// On MCP initialization you should grab project root path from command line arguments.
const projectRoot = process.argv[2]

if (!projectRoot) {
  console.error('[Graphens Workspace MCP] Error: Project root path was not provided as an argument.')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const versionPath = join(__dirname, 'version.json')

let mcpVersion = '1.0.0'
try {
  const versionInfo = JSON.parse(readFileSync(versionPath, 'utf-8'))
  if (versionInfo.version) {
    mcpVersion = versionInfo.version
  }
} catch (error) {
  console.error('[Graphens Workspace MCP] Failed to read version from version.json:', error)
}

const server = new McpServer(
  {
    name: 'graphens-workspace-mcp',
    version: mcpVersion,
  }
)

// TP Info Tool
server.registerTool(
  'tp_info',
  {
    description: "Récupère les métadonnées du TP actuel (identifiants de l'UE, du cours, et nom du TP) à partir de la configuration `.graphens/config.yaml`. Recommandé avant d'appeler le RAG pour obtenir les métadonnées du TP."
  },
  async () => {
    try {
      const config = await getGraphensConfig(projectRoot)
      if (!config) {
        return {
          content: [{ type: 'text', text: 'No Graphens configuration found.' }]
        }
      }
      const coords = {
        ue: config.ue ?? '',
        cours: config.cours ?? '',
        tp_name: config.tp_name ?? ''
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(coords, null, 2) }]
      }
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error retrieving TP coordinates: ${error.message}` }],
        isError: true
      }
    }
  }
)

// TP Recommendations Tool
server.registerTool(
  'tp_recommendations',
  {
    description: "Récupère les recommandations et les consignes du TP actuel (contenu du README.md, fichiers locaux `.graphens/*.md` et fichiers distants configurés)."
  },
  async () => {
    try {
      const [readme, localFiles, remoteFiles] = await Promise.all([
        getReadme(projectRoot),
        getGraphensFiles(projectRoot),
        getGraphensSources(projectRoot)
      ])
      
      let text = ''
      if (readme) {
        text += `## README.md\n\n${readme}\n\n====================\n\n`
      }
      
      text += "Custom instructions for the AI:\n\n"
      if (localFiles.length === 0 && remoteFiles.length === 0) {
        text += "No custom instructions or recommendations found."
      } else {
        const parts = [
          ...localFiles.map(f => `--- (Local File)\ntitle: ${f.name}\n---\n${f.content}`),
          ...remoteFiles.map(f => `--- (Remote File)\ntitle: ${f.url}\n---\n${f.content}`)
        ]
        text += parts.join("\n\n====================\n\n")
      }
      return {
        content: [{ type: 'text', text }]
      }
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error retrieving TP recommendations: ${error.message}` }],
        isError: true
      }
    }
  }
)

async function run() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[Graphens Workspace MCP] Connected on stdio')
}

run().catch((error) => {
  console.error('[Graphens Workspace MCP] Fatal error in run():', error)
  process.exit(1)
})
