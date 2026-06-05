import * as vscode from 'vscode'


export const graphensResponder: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> => {
  if (request.command === 'debug_readme') {
    const { getReadme } = await import('./context/getReadme.js')
    const readme = await getReadme()
    if (readme === '') {
      return stream.markdown('No README.md file found in the workspace.')
    }
    return stream.markdown(readme)
  }
};