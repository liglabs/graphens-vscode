import * as vscode from 'vscode'
import z from 'zod';

export class WorkspaceCache {
  constructor (private ext: vscode.ExtensionContext){}

  public async set<T>(key: string, value: T) {
    await vscode.workspace.fs.createDirectory(this.ext.storageUri!)
    await vscode.workspace.fs.writeFile(
      this.getUri(key),
      Buffer.from(JSON.stringify(value), 'utf8')
    );
  }

  public async get<T>(key: string, defaultValue: T, schema: z.Schema<T>): Promise<T> {
    try {
      const raw = await vscode.workspace.fs.readFile(this.getUri(key));
      const dataRaw = JSON.parse(Buffer.from(raw).toString('utf8'));
      return schema.parse(dataRaw)
    } catch {
      return defaultValue
    }
  }

  private getUri(key: string): vscode.Uri {
    // Sanitize key to be a valid filename
    const filename = key.replace(/[^a-z0-9_-]/gi, '_') + '.json';
    return vscode.Uri.joinPath(this.ext.storageUri!, filename);
  }
}