import { consola } from "consola"
import * as vscode from 'vscode'

const isDebugging = !!vscode.debug.activeDebugSession

const logger = consola.withDefaults({
  level: isDebugging ? 5 : 0,
}).withTag('Graphens')

logger.info('isDebugging', isDebugging)

export default logger