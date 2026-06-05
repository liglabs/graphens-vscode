import { z } from 'zod'
import { vscode, type FromWebviewMessage } from '../vscode'
import { stateChangesBus } from './stateBus'

export interface VSRune<T> {
  value: T
  sync(): void
  unsync(): void
}

export function vsrune<TSchema extends z.ZodTypeAny>(
  key: string,
  schema: TSchema,
  defaultValue: z.infer<TSchema>
): VSRune<z.infer<TSchema>> {

  let state = $state<z.infer<TSchema>>(defaultValue)

  const sync = (event: Event) => {
    state = schema.parse((event as CustomEvent).detail)
  }

  stateChangesBus.addEventListener(`stateLoaded:${key}`, sync)

  $effect(() => {
    vscode.postMessage({ type: 'stateChanged', key, value: state } satisfies FromWebviewMessage)
  })

  return {
    get value(): z.infer<TSchema> {
      return state
    },
    set value(v: z.infer<TSchema>) {
      state = v
    },
    sync() {
      stateChangesBus.addEventListener(`stateLoaded:${key}`, sync)
    },
    unsync() {
      stateChangesBus.removeEventListener(`stateLoaded:${key}`, sync)
    }
  }
}
