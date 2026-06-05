import { workspace } from 'vscode'

export async function getReadme(): Promise<string> {
  const readmeUris = await workspace.findFiles('README.md', '**/node_modules/**', 1)
  const readmeUri = readmeUris[0]
  if (readmeUri === undefined) {
    return ''
  }
  const readmeContent = await workspace.openTextDocument(readmeUri)
  return readmeContent.getText()
}