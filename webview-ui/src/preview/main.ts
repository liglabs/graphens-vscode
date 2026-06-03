import './vscode-theme.css'
import '../app.css'
import { mount } from 'svelte'
import PreviewApp from './PreviewApp.svelte'

mount(PreviewApp, { target: document.getElementById('app')! })
