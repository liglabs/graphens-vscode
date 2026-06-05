import { type ToWebviewMessage } from '../vscode'


export const stateChangesBus = new EventTarget()

const handleMessageEvents = (event: MessageEvent) => {
    const msg = event.data as ToWebviewMessage
    if (msg.type === 'stateLoaded') {
      stateChangesBus.dispatchEvent(
        new CustomEvent(`stateLoaded:${msg.key}`, { detail: msg.state })
      )
    }
  }

window.addEventListener('message', handleMessageEvents)

export function unsyncStateChanges() {
  window.removeEventListener('message', handleMessageEvents)
}
