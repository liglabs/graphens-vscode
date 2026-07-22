import * as vscode from 'vscode'
import logger from '../logger'
import { getReadme, getGraphensSources, getGraphensConfig } from 'graphens-vscode-shared'
import { extractLinks, getFilesByLink } from '../participant/context/utils/getFilesByLink'
import { getCourseContent } from '../participant/context/utils/getCourseContent'
import { getLanguageServerErrors } from '../participant/context/utils/getLanguageServerErrors'
import { runCompiler } from '../participant/context/utils/runCompiler'
import { getHistory, getHistoryAsMessages } from '../participant/context/utils/getHistory'
import { isCheating } from '../participant/guards/cheating'
import { getHighlightedCode } from '../participant/context/utils/getHighlightedCode'
import { getOpenFiles } from '../participant/context/utils/getOpenFiles'
import { getGraphensFiles } from 'graphens-vscode-shared'
import { getSessionKey } from './getSessionKey'

export async function processDebugCommands(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<boolean> {
  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
  switch (request.command) {
    case 'debug_readme': {
      const readme = await getReadme(projectRoot)
      if (readme === '') {
        stream.markdown('No README.md file found in the workspace.')
        break
      }
      stream.markdown(readme)
      break
    }
    case 'debug_open_files': {
      const openFiles = await getOpenFiles()
      if (openFiles.length === 0) {
        stream.markdown('No open files found.')
        break
      }
      for (const file of openFiles) {
        stream.markdown(`### ${file.path}\n\n${file.content}\n\n`)
      }
      break
    }
    case 'debug_graphens_files': {
      const files = await getGraphensFiles(projectRoot)
      if (files.length === 0) {
        stream.markdown('No .graphens markdown files found in the workspace.')
        break
      }
      for (const file of files) {
        stream.markdown(`### ${file.name}\n\n${file.content}\n\n`)
      }
      break
    }
    case 'debug_highlighted_code': {
      const highlightedCode = await getHighlightedCode()
      if (!highlightedCode) {
        stream.markdown('No highlighted code found.')
        break
      }
      stream.markdown(`Voici le code mis en évidence dans l\'éditeur : \n\n`)
      stream.markdown(
        `\`\`\`json\n${JSON.stringify(highlightedCode, null, 2)}\n\`\`\``,
      )
      break
    }
    case 'debug_cheating_guard': {
      const isCheater = await isCheating(request.prompt, request.model, token)
      stream.markdown(
        `Cheating guard result: ${isCheater ? 'Cheater detected' : 'No cheating detected'}`,
      )
      break
    }
    case 'debug_history': {
      const history = getHistory(context)
      if (history.length === 0) {
        stream.markdown('No chat history found.')
        break
      }
      logger.info(context.history)
      logger.info(history)
      for (const message of history) {
        stream.markdown(
          `### ${message.role}\n\n${message.content}\n\n`,
        )
      }
      break
    }
    case 'debug_compiler': {
      const compilerOutput = await runCompiler(
        request.model,
        getHistoryAsMessages(context),
        token,
      )
      stream.markdown(
        `**Compile command:** \`${compilerOutput.command}\`\n\nCompiler output: \n\`\`\`shell\n${compilerOutput.output}\n\`\`\``,
      )
      break
    }
    case 'debug_language_server_errors': {
      const errors = await getLanguageServerErrors()
      if (errors.length === 0) {
        stream.markdown(
          'No language server diagnostics found for the active file.',
        )
        break
      }
      stream.markdown(`\`\`\`json\n${JSON.stringify(errors, null, 2)}\n\`\`\``)
      break
    }
    case 'debug_rag': {
      logger.info(request.prompt)
      const response = await getCourseContent(request.prompt)
      logger.info(response)
      stream.markdown('Fetched')
      break
    }
    case 'debug_mentioned_files': {
      const links = extractLinks(request.prompt)
      const files = await getFilesByLink(links.local, links.web)
      logger.info('Mentioned files : ', files)
      stream.markdown('Fetched files are in the console')
      break
    }
    case 'debug_graphens_config': {
      const config = await getGraphensConfig(projectRoot)
      logger.info(config)
      stream.markdown('Config is in logs')
      break
    }
    case 'debug_graphens_sources': {
      logger.info('Sources: ', await getGraphensSources(projectRoot))
      stream.markdown('Sources are in logs')
      break
    }
    case 'debug_session_id': {
      const id = getSessionKey(request, context)
      stream.markdown(`Session ID is \`${id}\``)
      break
    }
    default: {
      return false
    }
  }
  return true
}
