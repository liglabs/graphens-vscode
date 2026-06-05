import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import type { ToWebviewMessage, FromWebviewMessage } from './messages'

const WORKSPACE_STATE_KEY = 'graphens-ai.webviewState'

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

    webviewView.webview.onDidReceiveMessage((raw: unknown) => {
      const msg = raw as FromWebviewMessage
      if (msg.type === 'setState') {
        void this.handleSetState(msg.key, msg.value)
      }
    })

    void this.sendInit()

    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('graphens-ai')) {
          void this.sendInit()
        }
      })
    )
  }

  clearChat() {
    this.post({ type: 'clearChat' })
  }

  private async handleSetState(key: string, value: unknown) {
    const existing =
      this.context.workspaceState.get<Record<string, unknown>>(WORKSPACE_STATE_KEY) ?? {}
    await this.context.workspaceState.update(WORKSPACE_STATE_KEY, { ...existing, [key]: value })
  }

  private post(msg: ToWebviewMessage) {
    this.view?.webview.postMessage(msg)
  }

  private async sendInit() {
    const cfg = vscode.workspace.getConfiguration('graphens-ai')
    const apiKey =
      (await this.context.secrets.get('graphens-ai.apiKey')) ||
      cfg.get<string>('apiKey', '').trim()

    // VS Code settings/secrets provide defaults; workspaceState values take precedence
    const persisted =
      this.context.workspaceState.get<Record<string, unknown>>(WORKSPACE_STATE_KEY) ?? {}

    this.post({
      type: 'init',
      state: {
        backendUrl: cfg.get<string>('backendUrl', '').trim(),
        apiKey,
        ...persisted,
      },
    })
  }

  private buildHtml(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'webview-ui', 'dist', 'chat', 'index.html'
    )
    const htmlDir = path.dirname(htmlPath.fsPath)

    let html = fs.readFileSync(htmlPath.fsPath, 'utf-8')

    html = html.replace(/(src|href)="([^"]+)"/g, (match, attr, val: string) => {
      if (val.startsWith('http') || val.startsWith('vscode-') || val.startsWith('#') || val.startsWith('data:')) {
        return match
      }
      const abs = path.resolve(htmlDir, val)
      return `${attr}="${webview.asWebviewUri(vscode.Uri.file(abs))}"`
    })

    const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; connect-src *;`
    return html.replace(
      '<meta charset="UTF-8">',
      `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
    )
  }
}
