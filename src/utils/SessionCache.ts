import * as vscode from 'vscode'
import z from 'zod';

export class SessionCache {
  private initPromise: Promise<void>

  constructor (
    private ext: vscode.ExtensionContext,
    private sessionId: string
  ){
    this.initPromise = this.init()
  }

  public async set<T>(key: string, value: T) {
    await this.initPromise
    await vscode.workspace.fs.writeFile(
      this.getUri(key),
      Buffer.from(JSON.stringify(value), 'utf8')
    );
  }

  public async get<T>(key: string, schema: z.Schema<T>): Promise<T | null> {
    try {
      const raw = await vscode.workspace.fs.readFile(this.getUri(key));
      const dataRaw = JSON.parse(Buffer.from(raw).toString('utf8'));
      return schema.parse(dataRaw)
    } catch {
      return null
    }
  }

  private getUri(key: string): vscode.Uri {
    // Sanitize key to be a valid filename
    const filename = key.replace(/[^a-z0-9_-]/gi, '_') + '.json';
    return vscode.Uri.joinPath(this.ext.storageUri!, this.sessionId, filename);
  }

  private async init () {
    await vscode.workspace.fs.createDirectory(this.ext.storageUri!)
    const folderUri = vscode.Uri.joinPath(this.ext.storageUri!, this.sessionId)
    await vscode.workspace.fs.createDirectory(folderUri)
  }
}