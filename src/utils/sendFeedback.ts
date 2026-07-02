import { ResponseMetadata, ResponseMetadataSchema } from "../models/ResponseMetadata"
import { ofetch } from "ofetch"
import { } from 'ufo'


export async function sendFeedback(
  positive: boolean,
  metadata: unknown
) {
  const feedbackUrl = process.env.FEEDBACK_URL || 'https://graphens-feedback.fly.dev/feedback'
  const feedback = {
    positive,
    metadata
  }
  await ofetch(feedbackUrl, {
    method: 'POST',
    body: ResponseMetadataSchema.parse(feedback),
  })
}