import { AskRequest, AskResponse, AskResponseSchema } from '@graphens/schemas'

import { ofetch } from 'ofetch'
import {joinURL} from 'ufo'

export class RagService {
  private static adress = 'http://129.88.210.133:4205/api'

  public async test(): Promise<boolean> {
    try {
      await ofetch(joinURL(RagService.adress, 'status'))
      return true
    } catch {
      return false
    }
  }

  public async ask(req: AskRequest): Promise<AskResponse> {
    const resRaw = await ofetch(joinURL(RagService.adress, 'cl-ihm', 'ask'), {
      method: 'POST',
      body: req
    })
    return AskResponseSchema.parse(resRaw)
  }
}