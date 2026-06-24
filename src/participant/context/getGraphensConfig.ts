import { workspace } from 'vscode'
import { GraphensConfig, GraphensConfigSchema } from '../../models/GraphensConfig'
import * as yaml from 'yaml'

export async function getGraphensConfig(): Promise<GraphensConfig | null> {
  const docs = await workspace.findFiles('.graphens/config.y{a,}ml', '**/node_modules/**', 1)
  if (!docs.length) return null
  const content = await workspace.openTextDocument(docs[0]!)
  return GraphensConfigSchema.parse(yaml.parse(content.getText()))
}