import * as vscode from 'vscode'
import configStatic from '../config.static';

function toBase64UrlSafe(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function getSessionKey(request: vscode.ChatRequest, context: vscode.ChatContext): string {
  // The first turn is stable for the entire chat thread
  const firstTurn = context.history[0];
  if (firstTurn instanceof vscode.ChatRequestTurn) {
    return toBase64UrlSafe(`${firstTurn.participant}::${firstTurn.command}::${firstTurn.prompt}`)
  }
  // Fallback: current prompt (new conversation)
  return toBase64UrlSafe(`${configStatic.participantId}::${request.command}::${request.prompt}`)
}