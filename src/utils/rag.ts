import { AskRequest, AskResponse, AskResponseSchema } from '@graphens/schemas'

import { ofetch } from 'ofetch'
import {joinURL} from 'ufo'

export class RagService {
  private static adress = 'http://129.88.210.133:4205'

  public async ask(req: AskRequest): Promise<AskResponse> {
    const resRaw = await ofetch(joinURL(RagService.adress, 'api/cl-ihm/ask'), {
      method: 'POST',
      body: req
    })
    return AskResponseSchema.parse(resRaw)
  }
}