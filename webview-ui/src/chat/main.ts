import '../app.css'
import ChatApp from './ChatApp.svelte'
import { injectVscodeTheme } from '../theme'

injectVscodeTheme()

const app = new ChatApp({ target: document.getElementById('app')! })

export default app
