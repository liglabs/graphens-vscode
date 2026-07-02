import * as vscode from 'vscode'

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export function getHistory(context: vscode.ChatContext): HistoryMessage[] {
  const messages: HistoryMessage[] = []

  for (const turn of context.history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      messages.push({ role: 'user', content: turn.prompt })
    } else if (turn instanceof vscode.ChatResponseTurn) {
      const text = turn.response
        .filter((part): part is vscode.ChatResponseMarkdownPart => part instanceof vscode.ChatResponseMarkdownPart)
        .map(part => part.value.value)
        .join('')
      messages.push({ role: 'assistant', content: text })
    }
  }

  return messages
}

export function histoyToMessages(history: HistoryMessage[]): vscode.LanguageModelChatMessage[] {
  return history.map(msg => {
    if (msg.role === 'user') {
      return vscode.LanguageModelChatMessage.User(msg.content)
    } else {
      return vscode.LanguageModelChatMessage.Assistant(msg.content)
    }
  })
}

export function getHistoryAsMessages(context: vscode.ChatContext): vscode.LanguageModelChatMessage[] {
  return histoyToMessages(getHistory(context))
}