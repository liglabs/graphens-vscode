import * as vscode from 'vscode'
import { getLanguageServerErrors } from '../utils/getLanguageServerErrors'
import { SessionCache } from '../../../utils/SessionCache'
import { errorExists } from '../utils/errorExists'
import { CompilerResultSchema, runCompiler } from '../utils/runCompiler'
import { getHistory } from '../utils/getHistory'
import type { ParticipantContext } from '../../../models/ParticipantContext'

const outputKey = 'latestCompilerOutput'

export async function getErrorsContextMessages(ctx: ParticipantContext, cache: SessionCache): Promise<vscode.LanguageModelChatMessage[]>{
  const messages = []
  const [lspStats, compilerResult] = await Promise.all([
    getLanguageServerErrors(),
    getCompilerContextMessage(ctx, cache)
  ])
  if (lspStats.length) {
    messages.push(vscode.LanguageModelChatMessage.User(`Voici les erreurs du serveur de langage pour le fichier actif :\n\n\`\`\`json\n${JSON.stringify(lspStats, null, 2)}\n\`\`\``))
  }
  if (compilerResult) {
    messages.push(compilerResult)
  }
  return messages
}

async function getCompilerContextMessage(ctx: ParticipantContext, cache: SessionCache): Promise<vscode.LanguageModelChatMessage | null> {
  const cached = await cache.get(outputKey, CompilerResultSchema)
  const hasErrors = await errorExists(ctx.request.model, ctx.request.prompt, ctx.token, cached || undefined)
  if (!hasErrors)
    return null
  const compilerOutput = await runCompiler(ctx.request.model, getHistory(ctx.context), ctx.token)
  await cache.set(outputKey, compilerOutput)
  return vscode.LanguageModelChatMessage.User(`Voici le résultat de la tentative de compilation du projet :\n\n**Compile command:** \`${compilerOutput.command}\`\n\n **Success:** ${compilerOutput.success}\n\nCompiler output: \n\`\`\`shell\n${compilerOutput.output}\n\`\`\``)
}