import { workspace } from 'vscode'
import { GraphensConfig, GraphensConfigSchema } from '../../../models/GraphensConfig'
import * as yaml from 'yaml'
import logger from '../../../logger'
import ReadGraphensConfigError from '../../../errors/ReadGraphensConfigError'

export async function getGraphensConfig(): Promise<GraphensConfig | null> {
  const docs = await workspace.findFiles('.graphens/config.y{a,}ml', '**/node_modules/**', 1)
  if (!docs.length) return null
  try {
    const content = await workspace.openTextDocument(docs[0]!)
    return GraphensConfigSchema.parse(yaml.parse(content.getText()))
  } catch (e) {
    logger.error(e)
    throw new ReadGraphensConfigError(e)
  }
}