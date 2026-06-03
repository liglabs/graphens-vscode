<script lang="ts">
  import { afterUpdate } from 'svelte'
  import { type ToWebviewMessage } from '../vscode'
  import { readSse, extractResponseText, buildRequestHeaders, type ChatMessage, type HistoryMessage } from '../lib/chat.service'

  let messages: ChatMessage[] = []
  let history: HistoryMessage[] = []
  let inputText = ''
  let isStreaming = false
  let messagesEl: HTMLElement
  let backendUrl = ''
  let apiKey = ''

  afterUpdate(() => {
    messagesEl?.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' })
  })

  async function send() {
    const text = inputText.trim()
    if (!text || isStreaming) return
    inputText = ''

    if (!backendUrl) {
      messages = [...messages, { role: 'error', content: 'No backend URL configured. Set `graphens-ai.backendUrl` in VS Code settings.' }]
      return
    }

    history = [...history, { role: 'user', content: text }]
    messages = [...messages, { role: 'user', content: text }]
    isStreaming = true

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: buildRequestHeaders(apiKey),
        body: JSON.stringify({ messages: history }),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Backend responded ${response.status}: ${body || response.statusText}`)
      }

      const contentType = response.headers.get('content-type') ?? ''
      let assistantText = ''

      if (contentType.includes('text/event-stream')) {
        messages = [...messages, { role: 'assistant', content: '' }]
        for await (const chunk of readSse(response)) {
          assistantText += chunk
          const last = messages.at(-1)!
          messages = [...messages.slice(0, -1), { ...last, content: last.content + chunk }]
        }
      } else {
        const data = (await response.json()) as Record<string, unknown>
        assistantText = extractResponseText(data)
        messages = [...messages, { role: 'assistant', content: assistantText }]
      }

      history = [...history, { role: 'assistant', content: assistantText }]
    } catch (err) {
      messages = [...messages, { role: 'error', content: err instanceof Error ? err.message : String(err) }]
      history = history.slice(0, -1) // remove the failed user turn
    } finally {
      isStreaming = false
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as ToWebviewMessage

    if (msg.type === 'init') {
      backendUrl = msg.backendUrl
      apiKey = msg.apiKey
    } else if (msg.type === 'clearChat') {
      messages = []
      history = []
      isStreaming = false
    }
  })
</script>

<div class="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden">
  <!-- message list -->
  <div class="flex-1 overflow-y-auto p-2 space-y-1" bind:this={messagesEl}>
    {#each messages as msg, i (i)}
      <div class="chat {msg.role === 'user' ? 'chat-end' : 'chat-start'}">
        <div
          class="chat-bubble text-sm whitespace-pre-wrap break-words
            {msg.role === 'user'  ? 'chat-bubble-primary' : ''}
            {msg.role === 'error' ? 'chat-bubble-error'   : ''}"
        >
          {msg.content}{#if msg.role === 'assistant' && isStreaming && i === messages.length - 1}<span class="animate-pulse">▍</span>{/if}
        </div>
      </div>
    {/each}

    {#if isStreaming && (messages.at(-1)?.role !== 'assistant')}
      <div class="chat chat-start">
        <div class="chat-bubble chat-bubble-ghost">
          <span class="loading loading-dots loading-xs"></span>
        </div>
      </div>
    {/if}
  </div>

  <!-- input -->
  <div class="flex gap-2 p-2 border-t border-base-300">
    <textarea
      class="textarea textarea-bordered flex-1 resize-none text-sm leading-snug min-h-[4rem] max-h-40"
      placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
      bind:value={inputText}
      on:keydown={handleKeydown}
      disabled={isStreaming}
    ></textarea>
    <button
      class="btn btn-primary self-end"
      on:click={() => void send()}
      disabled={isStreaming || !inputText.trim()}
    >
      {#if isStreaming}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        Send
      {/if}
    </button>
  </div>
</div>
