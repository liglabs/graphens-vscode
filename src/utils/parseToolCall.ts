import * as vscode from 'vscode'

interface Schema<T> {
  parse: (data: unknown) => T
}

export async function parseToolCallFromStream<T>(
  response: vscode.LanguageModelChatResponse,
  toolName: string,
  schema: Schema<T>
): Promise<T | null> {
  for await (const part of response.stream) {
    if (part instanceof vscode.LanguageModelToolCallPart && part.name === toolName) {
      return schema.parse(part.input)
    }
  }
  return null
}
