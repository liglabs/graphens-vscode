import logger from "../../../logger"
import { RagService } from "../../../utils/rag"

const rag = new RagService()

export async function getCourseContent(prompt: string) {
  if (!(await rag.test())) return []
  try {
    const { resultats: { resultatsBM25, resultatsVectoriel } } = await rag.ask({
      question: prompt,
      nbResultats: 3
    })

    for (const res of resultatsBM25) {
      if (!resultatsVectoriel.some(v => v.texte === res.texte)) {
        resultatsVectoriel.push(res)
      }
    }

    return resultatsVectoriel
  } catch(e) {
    logger.error(e)
    return []
  }
}