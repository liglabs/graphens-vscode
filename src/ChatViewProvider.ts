import * as vscode from 'vscode'

// Messages sent from extension host → webview
type ToWebviewMessage =
  | { type: 'init'; backendUrl: string; apiKey: string }
  | { type: 'clearChat' }

export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'graphens-ai.chat'

  private view?: vscode.WebviewView

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    }

    webviewView.webview.html = this.buildHtml(webviewView.webview)

    void this.sendConfig()

    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('graphens-ai')) {
          void this.sendConfig()
        }
      })
    )
  }

  clearChat() {
    this.post({ type: 'clearChat' })
  }

  private post(msg: ToWebviewMessage) {
    this.view?.webview.postMessage(msg)
  }

  private async sendConfig() {
    const cfg = vscode.workspace.getConfiguration('graphens-ai')
    const backendUrl = cfg.get<string>('backendUrl', '').trim()
    const apiKey =
      (await this.context.secrets.get('graphens-ai.apiKey')) ||
      cfg.get<string>('apiKey', '').trim() ||
      ''
    this.post({ type: 'init', backendUrl, apiKey })
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'chat.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'app.css')
    )
    const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; connect-src *;`

    return /* html */ `<!DOCTYPE html>
<html lang="en" data-theme="vscode">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Graphens AI Chat</title>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`
  }
}
