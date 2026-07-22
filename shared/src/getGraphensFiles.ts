import * as fs from 'fs/promises'
import * as path from 'path'
import { parseFilename } from 'ufo'
import { exists } from './exists.js'

export interface GraphensFile {
  name: string
  content: string
}

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
