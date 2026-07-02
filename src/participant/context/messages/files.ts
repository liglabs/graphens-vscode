import { getFilesByLink, extractLinks, LinkResultSchema } from '../utils/getFilesByLink'
import { SessionCache } from '../../../utils/SessionCache'

const cacheKey = 'remoteFiles'

export async function getFilesContextMessage(prompt: string, cache: SessionCache): Promise<string[]>{
  const files = extractLinks(prompt)
  const cachedWebFiles = (await cache.get(cacheKey, LinkResultSchema.array())) || []
  for (const f of cachedWebFiles) {
    const i = files.web.indexOf(f.original)
    if (i > -1) {
      files.web.splice(i, 1)
    }
  }
  const results = await getFilesByLink(files.local, files.web)
  await cache.set(cacheKey, [...results.filter(f => f.type==='web'), ...cachedWebFiles])
  return [...results, ...cachedWebFiles].map(f => `### L'utilisateur a un fichier ${f.type} ${f.original}\n\n${f.content}`)
}