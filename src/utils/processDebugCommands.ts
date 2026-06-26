import * as vscode from 'vscode'
import logger from '../logger'
import { getReadme } from '../participant/context/getReadme'
import { getOpenFiles } from '../participant/context/getOpenFiles'
import { getGraphensSources } from '../participant/context/getGraphensSources'
import { getGraphensConfig } from '../participant/context/getGraphensConfig'
import { getFilesByLink } from '../participant/context/getFilesByLink'
import { getCourseContent } from '../participant/context/getCourseContent'
import { getLanguageServerErrors } from '../participant/context/getLanguageServerErrors'
import { runCompiler } from '../participant/context/runCompiler'
import { getHistory } from '../participant/context/getHistory'
import { isCheating } from '../participant/guards/cheating'
import { getHighlightedCode } from '../participant/context/getHighlightedCode'
import { getGraphensFiles } from '../participant/context/getGraphensFiles'

export async function processDebugCommands(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<boolean> {
  switch (request.command) {
    case 'debug_readme': {
      const readme = await getReadme()
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
      const files = await getGraphensFiles()
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
          `### ${message.role}\n\n${message.content.join('')}\n\n`,
        )
      }
      break
    }
    case 'debug_compiler': {
      const compilerOutput = await runCompiler(
        request.model,
        getHistory(context),
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
      const files = await getFilesByLink(request.prompt)
      logger.info('Mentioned files : ', files)
      stream.markdown('Fetched files are in the console')
      break
    }
    case 'debug_graphens_config': {
      const config = await getGraphensConfig()
      logger.info(config)
      stream.markdown('Config is in logs')
      break
    }
    case 'debug_graphens_sources': {
      logger.info('Sources: ', await getGraphensSources())
      stream.markdown('Sources are in logs')
      break
    }
    default: {
      return false
    }
  }
  return true
}
