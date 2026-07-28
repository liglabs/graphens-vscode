import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'yaml'
import { defu } from 'defu'
import { exists } from './exists.js'
import { GraphensConfigSchema } from './GraphensConfig.js'
import type { GraphensConfig } from './GraphensConfig.js'
import ReadGraphensConfigError from './ReadGraphensConfigError.js'

export async function getGraphensConfig(
  projectRoot: string,
  onError?: (e: Error) => void
): Promise<GraphensConfig | null> {
  const jsonPath = path.join(projectRoot, '.graphens', 'config.json')
  const yamlPath = path.join(projectRoot, '.graphens', 'config.yaml')
  const ymlPath = path.join(projectRoot, '.graphens', 'config.yml')

  let jsonConfig: any = null
  let yamlConfig: any = null
  let ymlConfig: any = null
  let hasAnyConfig = false

  try {
    if (await exists(jsonPath)) {
      hasAnyConfig = true
      const content = await fs.readFile(jsonPath, 'utf-8')
      jsonConfig = JSON.parse(content)
    }

    if (await exists(yamlPath)) {
      hasAnyConfig = true
      const content = await fs.readFile(yamlPath, 'utf-8')
      yamlConfig = yaml.parse(content)
    }

    if (await exists(ymlPath)) {
      hasAnyConfig = true
      const content = await fs.readFile(ymlPath, 'utf-8')
      ymlConfig = yaml.parse(content)
    }

    if (!hasAnyConfig) {
      return null
    }

    const merged = defu(jsonConfig || {}, yamlConfig || {}, ymlConfig || {})
    return GraphensConfigSchema.parse(merged)
  } catch (e: any) {
    console.error(e)
    if (onError) {
      onError(new ReadGraphensConfigError(e))
    }
    return null
  }
}
