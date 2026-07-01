import { consola } from "consola"
import * as vscode from 'vscode'

const isDebugging = !!vscode.debug.activeDebugSession

export default consola.withDefaults({
  level: isDebugging ? 5 : 0,
}).withTag('Graphens')