import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'yaml'
import { exists } from './exists.js'
import { GraphensConfigSchema } from './GraphensConfig.js'
import type { GraphensConfig } from './GraphensConfig.js'
import ReadGraphensConfigError from './ReadGraphensConfigError.js'

export async function getGraphensConfig(
  projectRoot: string,
  onError?: (e: Error) => void
): Promise<GraphensConfig | null> {
  let configPath = path.join(projectRoot, '.graphens', 'config.yaml')
  let hasConfig = await exists(configPath)

  if (!hasConfig) {
    configPath = path.join(projectRoot, '.graphens', 'config.yml')
    hasConfig = await exists(configPath)
  }

  if (!hasConfig) {
    return null
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8')
    return GraphensConfigSchema.parse(yaml.parse(content))
  } catch (e: any) {
    console.error(e)
    if (onError) {
      onError(new ReadGraphensConfigError(e))
    }
    return null
  }
}
