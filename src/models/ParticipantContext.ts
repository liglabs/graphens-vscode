import * as vscode from 'vscode'

export interface ParticipantContext {
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
}