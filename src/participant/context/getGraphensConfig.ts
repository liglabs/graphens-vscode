import { workspace } from 'vscode'
import { GraphensConfig, GraphensConfigSchema } from '../../models/GraphensConfig'

export async function getGraphensConfig(): Promise<GraphensConfig | null> {
  const docs = await workspace.findFiles('.graphens/config.y{a,}ml', '**/node_modules/**', 1)
  if (!docs.length) return null
  const content = await workspace.openTextDocument(docs[0]!)
  return GraphensConfigSchema.parse(content.getText())
}