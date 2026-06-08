import * as vscode from 'vscode'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getReadme } from './getReadme'

const execAsync = promisify(exec)

const outputChannel = vscode.window.createOutputChannel('Graphens Compiler')

export interface CompilerResult {
  command: string
  output: string
  success: boolean
}

interface ProjectFileInfo {
  platform: string
  filename: string
  content: string
}

const COMPILE_COMMAND_TOOL: vscode.LanguageModelChatTool = {
  name: 'report_compile_command',
  description: 'Report the shell command to compile or type-check the project to detect errors',
  inputSchema: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to run (e.g. "npx tsc --noEmit", "mvn compile", "python -m py_compile src/main.py")'
      },
      reason: {
        type: 'string',
        description: 'One-sentence explanation of why this command was chosen'
      }
    },
    required: ['command']
  }
}

const PROJECT_FILE_PATTERNS: Array<{ pattern: string; platform: string }> = [
  { pattern: 'package.json', platform: 'Node.js' },
  { pattern: 'tsconfig.json', platform: 'TypeScript' },
  { pattern: 'pom.xml', platform: 'Java (Maven)' },
  { pattern: 'build.gradle', platform: 'Java (Gradle)' },
  { pattern: 'build.gradle.kts', platform: 'Java (Gradle Kotlin)' },
  { pattern: 'setup.py', platform: 'Python' },
  { pattern: 'pyproject.toml', platform: 'Python' },
  { pattern: 'requirements.txt', platform: 'Python' },
]

async function findProjectFiles(): Promise<ProjectFileInfo[]> {
  const results: ProjectFileInfo[] = []

  await Promise.all(
    PROJECT_FILE_PATTERNS.map(async ({ pattern, platform }) => {
      const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1)
      const uri = uris[0]
      if (uri !== undefined) {
        const doc = await vscode.workspace.openTextDocument(uri)
        results.push({ platform, filename: pattern, content: doc.getText() })
      }
    })
  )

  return results
}

async function detectCompileCommand(
  model: vscode.LanguageModelChat,
  projectFiles: ProjectFileInfo[],
  readme: string,
  token: vscode.CancellationToken
): Promise<string | null> {
  const projectFilesSection = projectFiles.length > 0
    ? projectFiles
        .map(f => `### ${f.filename} (${f.platform})\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n')
    : 'No recognized project files found.'

  const readmeSection = readme ? `## README.md\n\n${readme}` : 'No README.md found.'

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `You are a build system expert. Based on the project files below, determine the best command to compile or type-check the project to surface errors.\n\n` +
      `Supported platforms: Node.js, Java, Python.\n\n` +
      `Guidelines:\n` +
      `- Node.js + TypeScript (tsconfig.json present): prefer "npx tsc --noEmit"\n` +
      `- Node.js without TypeScript: use "npm run build" if a build script exists in package.json\n` +
      `- Java Maven (pom.xml): use "mvn compile"\n` +
      `- Java Gradle (build.gradle): use "gradle build"\n` +
      `- Python: use "python -m py_compile <main_file>" or "python -m compileall ." for multiple files\n\n` +
      `Use the report_compile_command tool to report your chosen command.\n\n` +
      `${readmeSection}\n\n` +
      `## Detected Project Files\n\n${projectFilesSection}`
    )
  ]

  const response = await model.sendRequest(
    messages,
    { tools: [COMPILE_COMMAND_TOOL], toolMode: vscode.LanguageModelChatToolMode.Required },
    token
  )

  for await (const part of response.stream) {
    if (part instanceof vscode.LanguageModelToolCallPart && part.name === COMPILE_COMMAND_TOOL.name) {
      const input = part.input as { command?: string }
      return input.command ?? null
    }
  }

  return null
}

export async function runCompiler(
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken
): Promise<CompilerResult> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  const [readme, projectFiles] = await Promise.all([getReadme(), findProjectFiles()])

  const command = await detectCompileCommand(model, projectFiles, readme, token)

  if (!command) {
    return { command: '', output: 'Could not determine a compile command for this project.', success: false }
  }

  outputChannel.clear()
  outputChannel.appendLine(`> ${command}\n`)
  outputChannel.show(true)

  try {
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: 60_000 })
    const output = [stdout, stderr].filter(Boolean).join('\n')
    outputChannel.append(output)
    return { command, output, success: true }
  } catch (err: unknown) {
    const execError = err as { stdout?: string; stderr?: string; message?: string }
    const output = [execError.stdout, execError.stderr, execError.message].filter(Boolean).join('\n')
    outputChannel.append(output)
    return { command, output, success: false }
  }
}
