import { workspace } from 'vscode'
import { parseFilename } from 'ufo'

interface GraphensFile {
  name: string
  content: string
}

export async function getReadme(): Promise<GraphensFile[]> {
  const docs = await workspace.findFiles('.graphens/**.md', '**/node_modules/**', 1)
  const files: GraphensFile[] = []
  for (const doc of docs) {
    const content = await workspace.openTextDocument(doc)
    files.push({
      name: parseFilename(doc.toString()) || 'unknown',
      content: content.getText()
    })
  }
  return files
}