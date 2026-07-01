import { Subject, filter, distinctUntilChanged, switchMap, timer, map, tap } from 'rxjs'
import logger from '../logger';
import { sep } from 'path';
import * as vscode from 'vscode'

function parseFilename(abs: string): string {
  return abs.split(sep).at(-1) || 'undefined'
}

function getFirstLine(event: vscode.TextDocumentChangeEvent): number | undefined {
  return event.contentChanges[0]?.range.start.line;
}

type AnchorKey = { uri: string; line: number };

function extractAnchor(event: vscode.TextDocumentChangeEvent): AnchorKey | null {
  const line = getFirstLine(event);
  if (line === undefined) return null;
  return { uri: event.document.uri.toString(), line };
}

function anchorChanged(prev: AnchorKey, next: AnchorKey): boolean {
  return prev.uri !== next.uri || Math.abs(prev.line - next.line) > 10;
}

export function startBlockedTracker(): vscode.Disposable {
  logger.info('Starting blocked tracker')
  const docChanges$ = new Subject<vscode.TextDocumentChangeEvent>()
  const disposable = vscode.workspace.onDidChangeTextDocument((event) => docChanges$.next(event))

  const subscription = docChanges$.pipe(
    // Drop no-content events (e.g. dirty-state changes)
    filter(event => event.contentChanges.length > 0),

    // Drop extension logs
    filter(event => event.document.fileName !== 'exthost'),

    filter(event => event.document.uri.scheme !== 'chatSessionInput'),

    // Compute the anchor key for this event
    filter(event => getFirstLine(event) !== undefined),

    tap(event => logger.debug('Doc changed : ', event) ),

    // Only propagate when the anchor actually changes (different file or >10 lines away)
    distinctUntilChanged((prev, curr) => {
      const a = extractAnchor(prev)!;
      const b = extractAnchor(curr)!;
      return !anchorChanged(a, b); // returning true = "equal" = suppress emission
    }),
    // Every new anchor cancels the previous timer and starts a fresh 5-minute one.
    // switchMap does the cancellation automatically.
    switchMap(anchorEvent =>
      timer(5 * 60 * 1000).pipe(
        // Carry the anchor event through to the subscriber
        map(() => anchorEvent)
      )
    )
  ).subscribe((anchorEvent) => {
    const line = getFirstLine(anchorEvent);
    const file = anchorEvent.document.fileName;

    vscode.window.showInformationMessage(
      `Vous modifiez autour de la ligne ${line! + 1} dans "${parseFilename(file)}" depuis 5 minutes. Besoin d'aide ?`,
      'Demander à l\'IA',
      'Fermer'
    ).then(res => {
      if (res !== 'Demander à l\'IA') return
      return vscode.commands.executeCommand(
        'workbench.action.chat.open',
        {
          query: `@graphens Je suis bloqué(e) à la ligne ${line} de ${parseFilename(file)}. Peux-tu m'aider à comprendre quel pourrait être le problème ?`
        }
      );
    })
  })

  return {
    dispose() {
      disposable.dispose()
      subscription.unsubscribe()
    },
  }
}