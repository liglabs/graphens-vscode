import * as vscode from 'vscode'

export interface LanguageServerError {
  path: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'information' | 'hint'
  message: string
  source?: string
}

export async function getLanguageServerErrors(): Promise<LanguageServerError[]> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return []
  }

  const uri = editor.document.uri
  const diagnostics = vscode.languages.getDiagnostics(uri)

  return diagnostics.map(d => ({
    path: uri.fsPath,
    line: d.range.start.line + 1,
    column: d.range.start.character + 1,
    severity: severityLabel(d.severity),
    message: d.message,
    source: d.source
  }))
}

function severityLabel(severity: vscode.DiagnosticSeverity): LanguageServerError['severity'] {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:       return 'error'
    case vscode.DiagnosticSeverity.Warning:     return 'warning'
    case vscode.DiagnosticSeverity.Information: return 'information'
    default:                                    return 'hint'
  }
}
