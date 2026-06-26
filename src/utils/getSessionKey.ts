import * as vscode from 'vscode'
import configStatic from '../config.static';

function getSessionKey(request: vscode.ChatRequest, context: vscode.ChatContext): string {
  // The first turn is stable for the entire chat thread
  const firstTurn = context.history[0];
  if (firstTurn instanceof vscode.ChatRequestTurn) {
    return btoa(`${firstTurn.participant}::${firstTurn.command}::${firstTurn.prompt}`)
  }
  // Fallback: current prompt (new conversation)
  return btoa(`${configStatic.participantId}::${request.command}::${request.prompt}`)
}