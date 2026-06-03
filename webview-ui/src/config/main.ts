import '../app.css'
import ConfigApp from './ConfigApp.svelte'
import { injectVscodeTheme } from '../theme'

injectVscodeTheme()

const app = new ConfigApp({ target: document.getElementById('app')! })

export default app
