import { ofetch } from "ofetch";
import { getGraphensConfig } from "./getGraphensConfig";

export interface GraphensSource {
  url: string
  content: string
}

/**
 * Downloads files listed in sources in .graphens/config.yaml
 * @returns List of successfully downloaded files
 */
export async function getGraphensSources() {
  const config = await getGraphensConfig()
  if (!config?.sources) return []
  const promises = config.sources.map(async (src) => {
    // TODO: Verify if it is a text file
    return {
      url: src,
      content: await ofetch(src)
    } as GraphensSource
  })
  return (await Promise.allSettled(promises))
    .filter(src => src.status === "fulfilled")
    .map(src => src.value)
}