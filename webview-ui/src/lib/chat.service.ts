export interface ChatMessage {
  role: 'user' | 'assistant' | 'error'
  content: string
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function* readSse(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return
        try {
          const parsed = JSON.parse(payload) as Record<string, unknown>
          const text =
            typeof parsed['text']    === 'string' ? parsed['text'] :
            typeof parsed['content'] === 'string' ? parsed['content'] :
            typeof parsed['delta']   === 'object' && parsed['delta'] !== null &&
              typeof (parsed['delta'] as Record<string, unknown>)['text'] === 'string'
              ? (parsed['delta'] as Record<string, unknown>)['text'] as string
            : ''
          if (text) yield text
        } catch { /* non-JSON SSE line */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function extractResponseText(data: Record<string, unknown>): string {
  if (typeof data['message'] === 'string') return data['message']
  if (typeof data['content'] === 'string') return data['content']
  if (typeof data['text']    === 'string') return data['text']
  return JSON.stringify(data)
}

export function buildRequestHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  return headers
}
