import * as fs from 'fs/promises'
import * as path from 'path'
import { exists } from './exists.js'

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
