import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as fs from 'fs/promises'
import * as path from 'path'

// On MCP initialization you should grab project root path from command line arguments.
const projectRoot = process.argv[2]

if (!projectRoot) {
  console.error('[Graphens Workspace MCP] Error: Project root path was not provided as an argument.')
  process.exit(1)
}

const server = new McpServer(
  {
    name: 'graphens-workspace-mcp',
    version: '0.1.0',
  }
)

// Helper to recursively find README.md in directory (excluding node_modules, dist, etc.)
async function findReadme(dir: string): Promise<string | null> {
  try {
    const files = await fs.readdir(dir)
    
    // First check for a direct match in the current directory (case-insensitive)
    const readmeFile = files.find(f => f.toLowerCase() === 'readme.md')
    if (readmeFile) {
      return path.join(dir, readmeFile)
    }

    // Otherwise look in subdirectories recursively
    for (const file of files) {
      if (
        file === 'node_modules' ||
        file === '.git' ||
        file === 'dist' ||
        file === '.turbo' ||
        file === '.vscode' ||
        file === 'build'
      ) {
        continue
      }
      const fullPath = path.join(dir, file)
      const stat = await fs.stat(fullPath)
      if (stat.isDirectory()) {
        const found = await findReadme(fullPath)
        if (found) {
          return found
        }
      }
    }
  } catch (error) {
    // Ignore and proceed
  }
  return null
}

server.registerTool(
  'get_readme', 
  {
    description: "Grab or retrieve the contents of the workspace's README.md file."
  },
  async () => {
  try {
    const readmePath = await findReadme(projectRoot)
    if (!readmePath) {
      return {
          content: [
            {
              type: 'text',
              text: "Aucun fichier README.md trouvé dans l'espace de travail.",
            },
          ],
        }
      }

      const readmeContent = await fs.readFile(readmePath, 'utf-8')
      return {
        content: [
          {
            type: 'text',
            text: `Voici le contenu du README.md trouvé dans l'espace de travail :\n\n${readmeContent}`,
          },
        ],
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Erreur lors de la lecture du fichier README.md: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  })

async function run() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[Graphens Workspace MCP] Connected on stdio')
}

run().catch((error) => {
  console.error('[Graphens Workspace MCP] Fatal error in run():', error)
  process.exit(1)
})
