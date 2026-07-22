import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'yaml'
import { parseFilename } from 'ufo'
import { ofetch } from 'ofetch'
import { z } from 'zod'
import { GraphensConfigSchema, BlockersDetectorConfigSchema } from './GraphensConfig.js'
import type { GraphensConfig, BlockersDetectorConfig } from './GraphensConfig.js'
import ReadGraphensConfigError from './ReadGraphensConfigError.js'

export { GraphensConfigSchema, BlockersDetectorConfigSchema }
export type { GraphensConfig, BlockersDetectorConfig }
export { ReadGraphensConfigError }

export interface GraphensFile {
  name: string
  content: string
}

export const GraphensSourceSchema = z.object({
  url: z.string(),
  content: z.string()
})

export type GraphensSource = z.output<typeof GraphensSourceSchema>

// Helper to check if file/directory exists
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Grab or retrieve the contents of the workspace's README.md file.
 */
export async function getReadme(projectRoot: string): Promise<string> {
  try {
    const readmePath = path.join(projectRoot, 'README.md')
    if (await exists(readmePath)) {
      return await fs.readFile(readmePath, 'utf-8')
    }

    // Fallback: search case-insensitively in the root directory
    const files = await fs.readdir(projectRoot)
    const readmeFile = files.find((f) => f.toLowerCase() === 'readme.md')
    if (readmeFile) {
      return await fs.readFile(path.join(projectRoot, readmeFile), 'utf-8')
    }
  } catch (error) {
    // Ignore and return empty
  }
  return ''
}

/**
 * Retrieve the Graphens config from .graphens/config.yaml or .graphens/config.yml
 */
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

/**
 * Retrieve local .graphens/*.md files
 */
export async function getGraphensFiles(projectRoot: string): Promise<GraphensFile[]> {
  const graphensDir = path.join(projectRoot, '.graphens')
  if (!(await exists(graphensDir))) {
    return []
  }

  try {
    const files = await fs.readdir(graphensDir)
    const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'))
    const result: GraphensFile[] = []

    for (const file of mdFiles) {
      const fullPath = path.join(graphensDir, file)
      const content = await fs.readFile(fullPath, 'utf-8')
      result.push({
        name: parseFilename(fullPath) || 'unknown',
        content
      })
    }
    return result
  } catch (error) {
    return []
  }
}

/**
 * Download remote files listed in config.yaml
 */
export async function getGraphensSources(
  projectRoot: string,
  onConfigError?: (e: Error) => void
): Promise<GraphensSource[]> {
  const config = await getGraphensConfig(projectRoot, onConfigError)
  if (!config?.sources) {
    return []
  }

  const promises = config.sources.map(async (src: string) => {
    const response = await fetch(src, { method: 'HEAD' })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!(contentType.includes('text/') || contentType.includes('application/json'))) {
      throw new Error('File is not a text file')
    }

    return {
      url: src,
      content: await ofetch(src)
    } as GraphensSource
  })

  const results = await Promise.allSettled(promises)
  return results
    .filter((src: PromiseSettledResult<GraphensSource>): src is PromiseFulfilledResult<GraphensSource> => src.status === 'fulfilled')
    .map((src: PromiseFulfilledResult<GraphensSource>) => src.value)
}
