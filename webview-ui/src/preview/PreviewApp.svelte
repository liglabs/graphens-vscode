<script lang="ts">
  import { onMount } from 'svelte'
  import ChatApp from '../chat/ChatApp.svelte'
  import ConfigApp from '../config/ConfigApp.svelte'

  type Tab = 'chat' | 'config'
  let activeTab: Tab = 'chat'

  let backendUrl = ''
  let apiKey = ''

  function dispatchToWebview(data: unknown) {
    window.postMessage(data, '*')
  }

  function applyConfig() {
    dispatchToWebview({ type: 'init', backendUrl, apiKey })
  }

  function clearChat() {
    dispatchToWebview({ type: 'clearChat' })
  }

  onMount(() => {
    // Give child components time to register their message listeners
    setTimeout(applyConfig, 50)
  })
</script>

<div class="flex h-screen bg-base-200 text-base-content font-sans overflow-hidden">
  <!-- Controls sidebar -->
  <aside class="w-56 shrink-0 flex flex-col gap-4 border-r border-base-300 bg-base-100 p-3 overflow-y-auto">
    <div>
      <p class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">Preview Controls</p>

      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-0.5">
          <label class="text-xs font-medium" for="p-url">Backend URL</label>
          <input
            id="p-url"
            class="input input-bordered input-xs w-full"
            type="text"
            placeholder="http://localhost:8000/chat"
            bind:value={backendUrl}
          />
        </div>

        <div class="flex flex-col gap-0.5">
          <label class="text-xs font-medium" for="p-key">API Key</label>
          <input
            id="p-key"
            class="input input-bordered input-xs w-full"
            type="password"
            placeholder="Optional"
            bind:value={apiKey}
          />
        </div>

        <button class="btn btn-primary btn-xs" on:click={applyConfig}>Apply Config</button>
      </div>
    </div>

    <div class="divider my-0"></div>

    <div>
      <p class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">Actions</p>
      <button class="btn btn-ghost btn-xs w-full justify-start" on:click={clearChat}>Clear Chat</button>
    </div>

    <div class="divider my-0"></div>

    <div>
      <p class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">View</p>
      <div class="flex flex-col gap-1">
        <button
          class="btn btn-xs w-full justify-start {activeTab === 'chat' ? 'btn-primary' : 'btn-ghost'}"
          on:click={() => (activeTab = 'chat')}
        >Chat</button>
        <button
          class="btn btn-xs w-full justify-start {activeTab === 'config' ? 'btn-primary' : 'btn-ghost'}"
          on:click={() => (activeTab = 'config')}
        >Config</button>
      </div>
    </div>
  </aside>

  <!-- Webview simulation frame -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex items-center gap-2 px-3 py-1.5 border-b border-base-300 bg-base-100 shrink-0">
      <span class="text-xs text-base-content/50">Simulating:</span>
      <span class="text-xs font-medium">{activeTab === 'chat' ? 'graphens-ai.chat' : 'graphens-ai.config'}</span>
      <span class="badge badge-xs badge-ghost ml-auto">browser preview</span>
    </div>

    <div class="flex-1 overflow-hidden">
      {#if activeTab === 'chat'}
        <ChatApp />
      {:else}
        <ConfigApp />
      {/if}
    </div>
  </div>
</div>
