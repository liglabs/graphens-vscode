import * as vscode from 'vscode'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getReadme } from './getReadme'
import { reportCompileCommandTool, reportCompileCommandSchema } from '../../../tools/reportCompileCommand'
import { parseToolCallFromStream } from '../../../utils/parseToolCall'
import z from 'zod'

const execAsync = promisify(exec)

const outputChannel = vscode.window.createOutputChannel('Graphens Compiler')

export const CompilerResultSchema = z.object({
  command: z.string(),
  output: z.string(),
  success: z.boolean()
})

export type CompilerResult = z.output<typeof CompilerResultSchema>

interface ProjectFileInfo {
  platform: string
  filename: string
  content: string
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
    { tools: [reportCompileCommandTool], toolMode: vscode.LanguageModelChatToolMode.Required },
    token
  )

  const result = await parseToolCallFromStream(response, reportCompileCommandTool.name, reportCompileCommandSchema)
  return result?.command ?? null
}

export function getCompileCommandFromHistory(history: vscode.LanguageModelChatMessage[]): string | null {
  for (const message of [...history].reverse()) {
    if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
      const text = message.content
        .filter((part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart)
        .map(part => part.value)
        .join('')
      const match = text.match(/\*\*Compile command:\*\* `([^`]+)`/)
      if (match) {
        return match[1] ?? null
      }
    }
  }
  return null
}

export async function runCompiler(
  model: vscode.LanguageModelChat,
  history: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken
): Promise<CompilerResult> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  let command: string | null = getCompileCommandFromHistory(history)

  if (!command) {
    const [readme, projectFiles] = await Promise.all([getReadme(), findProjectFiles()])
    command = await detectCompileCommand(model, projectFiles, readme, token)
  }

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
    outputChannel.appendLine('\n[Process completed]')
    return { command, output, success: true }
  } catch (err: unknown) {
    const execError = err as { stdout?: string; stderr?: string; message?: string }
    const output = [execError.stdout, execError.stderr, execError.message].filter(Boolean).join('\n')
    outputChannel.append(output)
    outputChannel.appendLine('\n[Process completed with errors]')
    return { command, output, success: false }
  }
}
