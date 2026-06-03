import '../app.css'
import ChatApp from './ChatApp.svelte'

const app = new ChatApp({ target: document.getElementById('app')! })

export default app
