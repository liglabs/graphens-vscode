<script lang="ts">
  import { vscode, type ToWebviewMessage } from '../vscode'

  let backendUrl = ''
  let apiKey = ''
  let saved = false

  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as ToWebviewMessage
    if (msg.type === 'init') {
      backendUrl = msg.backendUrl
      apiKey = msg.apiKey
    }
  })

  function save() {
    vscode.postMessage({ type: 'updateConfig', backendUrl, apiKey })
    saved = true
    setTimeout(() => (saved = false), 2000)
  }
</script>

<div class="flex flex-col h-screen bg-base-100 text-base-content p-4 gap-4 overflow-y-auto">
  <h1 class="text-lg font-semibold">Graphens AI Settings</h1>

  <div class="flex flex-col gap-1">
    <label class="text-sm font-medium" for="backend-url">Backend URL</label>
    <input
      id="backend-url"
      class="input input-bordered input-sm"
      type="url"
      placeholder="https://your-backend.com/chat"
      bind:value={backendUrl}
    />
    <p class="text-xs text-base-content/60">POST endpoint that accepts <code>&#123; messages &#125;</code> and returns JSON or SSE.</p>
  </div>

  <div class="flex flex-col gap-1">
    <label class="text-sm font-medium" for="api-key">API Key</label>
    <input
      id="api-key"
      class="input input-bordered input-sm"
      type="password"
      placeholder="Optional bearer token"
      bind:value={apiKey}
    />
    <p class="text-xs text-base-content/60">Sent as <code>Authorization: Bearer &lt;key&gt;</code> when provided.</p>
  </div>

  <button class="btn btn-primary btn-sm self-start" on:click={save}>
    {#if saved}Saved ✓{:else}Save{/if}
  </button>
</div>
