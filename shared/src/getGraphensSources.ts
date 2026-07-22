import { z } from 'zod'
import { ofetch } from 'ofetch'
import { getGraphensConfig } from './getGraphensConfig.js'

export const GraphensSourceSchema = z.object({
  url: z.string(),
  content: z.string()
})

export type GraphensSource = z.output<typeof GraphensSourceSchema>

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
