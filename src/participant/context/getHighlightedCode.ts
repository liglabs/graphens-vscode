import * as vscode from 'vscode'

interface HighlightedCode {
  filename: string
  linesRange: [number, number]
  content: string
}

export async function getHighlightedCode(): Promise<HighlightedCode | null> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null; // or handle "no editor"
  }

  const selection = editor.selection;          // vscode.Selection
  const range = selection.isEmpty
    ? editor.document.lineAt(selection.start).range // whole line if nothing selected
    : selection;

  const highlightedCode = editor.document.getText(range);
  return {
    filename: editor.document.fileName,
    linesRange: [range.start.line, range.end.line],
    content: highlightedCode
  };
}