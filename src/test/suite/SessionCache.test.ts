import * as assert from 'assert'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { suite, test } from 'mocha'
import * as vscode from 'vscode'
import { z } from 'zod'

import { SessionCache } from '../../utils/SessionCache'

suite('SessionCache', () => {
  let tempDir: string
  let storageUri: vscode.Uri
  let context: vscode.ExtensionContext

  setup(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-cache-'))
    storageUri = vscode.Uri.file(tempDir)

    context = {
      storageUri,
      storagePath: tempDir,
      globalStorageUri: storageUri,
      globalStoragePath: tempDir,
      logUri: vscode.Uri.file(path.join(tempDir, 'log')),
      logPath: path.join(tempDir, 'log'),
      extensionUri: storageUri,
      extensionPath: tempDir,
      extensionMode: vscode.ExtensionMode.Test,
      globalState: {} as vscode.Memento,
      workspaceState: {} as vscode.Memento,
      secrets: {} as vscode.SecretStorage,
      subscriptions: [],
      extension: undefined as unknown as vscode.Extension<unknown>,
      environmentVariableCollection: {} as vscode.GlobalEnvironmentVariableCollection,
      extensionKind: vscode.ExtensionKind.UI,
      languageModelAccessInformation: undefined as unknown as vscode.LanguageModelAccessInformation,
      asAbsolutePath: (relativePath: string) => path.join(tempDir, relativePath)
    } as unknown as vscode.ExtensionContext
  })

  teardown(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('stores and reads values under a session-scoped folder', async () => {
    const cache = new SessionCache(context, 'session-one')
    const payload = { answer: 42, labels: ['one', 'two'] }

    await cache.set('profile', payload)

    const stored = await cache.get(
      'profile',
      z.object({
        answer: z.number(),
        labels: z.array(z.string())
      })
    )

    assert.deepStrictEqual(stored, payload)

    const expectedFile = vscode.Uri.joinPath(storageUri, 'session-one', 'profile.json')
    const stat = await vscode.workspace.fs.stat(expectedFile)
    assert.ok(stat.type === vscode.FileType.File)
  })

  test('returns null when the key does not exist', async () => {
    const cache = new SessionCache(context, 'session-two')

    const stored = await cache.get(
      'missing',
      z.object({ value: z.string() })
    )

    assert.strictEqual(stored, null)
  })

  test('returns null when the stored payload does not match the schema', async () => {
    const cache = new SessionCache(context, 'session-three')

    await cache.set('broken', { value: 7 })

    const stored = await cache.get(
      'broken',
      z.object({ value: z.string() })
    )

    assert.strictEqual(stored, null)
  })

  test('sanitizes keys into valid filenames', async () => {
    const cache = new SessionCache(context, 'session-four')

    await cache.set('my key/with:chars', { ok: true })

    const expectedFile = vscode.Uri.joinPath(storageUri, 'session-four', 'my_key_with_chars.json')
    const stat = await vscode.workspace.fs.stat(expectedFile)
    assert.ok(stat.type === vscode.FileType.File)
  })
})
