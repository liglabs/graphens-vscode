import { ofetch } from "ofetch";
import { getGraphensConfig } from "./getGraphensConfig";
import z from "zod";

export const GraphensSourceSchema = z.object({
  url: z.string(),
  content: z.string()
})

export type GraphensSource = z.output<typeof GraphensSourceSchema>

/**
 * Downloads files listed in sources in .graphens/config.yaml
 * @returns List of successfully downloaded files
 */
export async function getGraphensSources(onConfigError?: (e: Error)=>void) {
  const config = await getGraphensConfig(onConfigError)
  if (!config?.sources) return []
  const promises = config.sources.map(async (src) => {
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
  return (await Promise.allSettled(promises))
    .filter(src => src.status === "fulfilled")
    .map(src => src.value)
}