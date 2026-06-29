import * as vscode from 'vscode'

interface OpenFile {
  path: string
  content: string
}

export async function getOpenFiles(): Promise<OpenFile[]> {
  const openFiles = vscode.window.tabGroups.all.flatMap(group =>
    group.tabs
      .map(tab => {
        if (tab.input instanceof vscode.TabInputText) {
          return tab.input.uri.fsPath;
        }
        if (tab.input instanceof vscode.TabInputTextDiff) {
          return tab.input.modified.fsPath; // or original.fsPath
        }
        return null;
      })
      .filter((p): p is string => p !== null)
  );
  const files: OpenFile[] = []
  for (const file of openFiles) {
    const content = await vscode.workspace.openTextDocument(file)
    files.push({
      path: file,
      content: content.getText()
    })
  }
  return files
}