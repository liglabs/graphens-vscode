import * as vscode from 'vscode'
import * as crypto from 'crypto'
import { ofetch } from 'ofetch'
import { joinURL } from 'ufo'
import { authentikConfig } from './config.authentik'
import logger from './logger'

const SESSIONS_SECRET_KEY = 'graphens-ai.authentik.sessions'

interface StoredSession {
  id: string
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  account: {
    id: string
    label: string
  }
  scopes: string[]
}

export class AuthentikAuthenticationProvider implements vscode.AuthenticationProvider, vscode.Disposable {
  private _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>()
  readonly onDidChangeSessions = this._onDidChangeSessions.event

  private _uriHandlerDisposable: vscode.Disposable
  private _providerDisposable: vscode.Disposable | undefined

  private pendingStates = new Map<
    string,
    {
      verifier: string
      resolve: (value: vscode.AuthenticationSession) => void
      reject: (err: Error) => void
      scopes: string[]
    }
  >()

  constructor(private readonly context: vscode.ExtensionContext) {
    this._uriHandlerDisposable = vscode.window.registerUriHandler({
      handleUri: (uri) => this.handleUri(uri)
    })

    this._providerDisposable = vscode.authentication.registerAuthenticationProvider(
      'graphens-authentik',
      'Graphens Authentik OAuth',
      this,
      { supportsMultipleAccounts: false }
    )
    logger.info('AuthentikAuthenticationProvider registered successfully')
  }

  private async getStoredSessions(): Promise<StoredSession[]> {
    const raw = await this.context.secrets.get(SESSIONS_SECRET_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw)
    } catch (e) {
      logger.error('Failed to parse Authentik sessions from SecretStorage:', e)
      return []
    }
  }

  private async saveStoredSessions(sessions: StoredSession[]): Promise<void> {
    await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify(sessions))
  }

  async getSessions(
    scopes?: readonly string[],
    options?: vscode.AuthenticationProviderSessionOptions
  ): Promise<vscode.AuthenticationSession[]> {
    const stored = await this.getStoredSessions()
    const activeSessions: vscode.AuthenticationSession[] = []
    let updatedSessions: StoredSession[] = []
    let changed = false

    for (const session of stored) {
      let current = session
      // Check if token is expired or close to expiry (5 minutes buffer)
      if (session.expiresAt && Date.now() >= session.expiresAt - 5 * 60 * 1000 && session.refreshToken) {
        try {
          current = await this.refreshSessionToken(session)
          changed = true
        } catch (err) {
          logger.error('Failed to refresh Authentik token:', err)
          changed = true // Drop session as it is invalid/expired now
          continue
        }
      }
      updatedSessions.push(current)
      activeSessions.push({
        id: current.id,
        accessToken: current.accessToken,
        account: current.account,
        scopes: current.scopes
      })
    }

    if (changed) {
      await this.saveStoredSessions(updatedSessions)
      this._onDidChangeSessions.fire({
        added: [],
        removed: stored.filter(s => !updatedSessions.some(u => u.id === s.id)).map(s => ({
          id: s.id,
          accessToken: s.accessToken,
          account: s.account,
          scopes: s.scopes
        })),
        changed: updatedSessions.filter(u => {
          const orig = stored.find(s => s.id === u.id)
          return orig && orig.accessToken !== u.accessToken
        }).map(s => ({
          id: s.id,
          accessToken: s.accessToken,
          account: s.account,
          scopes: s.scopes
        }))
      })
    }

    // Filter by scopes if requested
    if (scopes && scopes.length > 0) {
      return activeSessions.filter((s) =>
        scopes.every((scope) => s.scopes.includes(scope))
      )
    }

    return activeSessions
  }

  async createSession(
    scopes: readonly string[],
    options?: vscode.AuthenticationProviderSessionOptions
  ): Promise<vscode.AuthenticationSession> {
    const { address, clientId, redirectUri } = authentikConfig

    if (!address || address === 'https://authentik.company.com' || !clientId || clientId === 'YOUR_CLIENT_ID') {
      const msg = 'Authentik OAuth is not configured. Please fill in the server address and client ID in `src/config.authentik.ts`.'
      vscode.window.showErrorMessage(msg)
      throw new Error(msg)
    }

    const state = crypto.randomBytes(16).toString('hex')
    const verifier = crypto.randomBytes(32).toString('base64url')
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

    const endpoints = this.getEndpoints(address)
    const queryParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: Array.from(new Set([...scopes, 'openid', 'profile', 'offline_access'])).join(' '),
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    }).toString()
    const authUrl = `${endpoints.authorize}?${queryParams}`
    logger.debug('Opening Authentik OAuth URL:', authUrl)

    return new Promise<vscode.AuthenticationSession>(async (resolve, reject) => {
      let timeout: NodeJS.Timeout | undefined

      const pending = {
        verifier,
        resolve: (session: vscode.AuthenticationSession) => {
          if (timeout) clearTimeout(timeout)
          resolve(session)
        },
        reject: (err: Error) => {
          if (timeout) clearTimeout(timeout)
          reject(err)
        },
        scopes: [...scopes]
      }

      this.pendingStates.set(state, pending)

      timeout = setTimeout(() => {
        this.pendingStates.delete(state)
        reject(new Error('Authentication timed out'))
      }, 5 * 60 * 1000)

      try {
        // For some reason Uri.parse decodes the URL, which breaks the OAuth flow, so we cast to any to bypass type checking
        await vscode.env.openExternal(authUrl as any)
      } catch (err) {
        this.pendingStates.delete(state)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  async removeSession(sessionId: string): Promise<void> {
    const stored = await this.getStoredSessions()
    const sessionToRemove = stored.find(s => s.id === sessionId)
    if (!sessionToRemove) {
      return
    }

    const updated = stored.filter(s => s.id !== sessionId)
    await this.saveStoredSessions(updated)

    this._onDidChangeSessions.fire({
      added: [],
      removed: [{
        id: sessionToRemove.id,
        accessToken: sessionToRemove.accessToken,
        account: sessionToRemove.account,
        scopes: sessionToRemove.scopes
      }],
      changed: []
    })
  }

  private async handleUri(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query)
    const code = params.get('code')
    const state = params.get('state')

    if (!code || !state) {
      return
    }

    const pending = this.pendingStates.get(state)
    if (!pending) {
      logger.warn('Received OAuth callback with unexpected state:', state)
      return
    }

    this.pendingStates.delete(state)

    try {
      const { address, clientId, redirectUri } = authentikConfig
      const endpoints = this.getEndpoints(address)
      const tokenUrl = endpoints.token

      const tokenResponse = await ofetch<any>(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          code: code,
          code_verifier: pending.verifier,
          grant_type: 'authorization_code'
        }).toString()
      })

      const userinfoUrl = endpoints.userinfo
      const userInfo = await ofetch<any>(userinfoUrl, {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`
        }
      })

      const accountId = userInfo.sub || crypto.randomBytes(8).toString('hex')
      const accountLabel = userInfo.preferred_username || userInfo.email || userInfo.name || 'Authentik User'

      const newStoredSession: StoredSession = {
        id: crypto.randomBytes(16).toString('hex'),
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_in ? Date.now() + tokenResponse.expires_in * 1000 : undefined,
        account: {
          id: accountId,
          label: accountLabel
        },
        scopes: pending.scopes
      }

      const stored = await this.getStoredSessions()
      // Since supportsMultipleAccounts is false, replace existing sessions
      await this.saveStoredSessions([newStoredSession])

      const session: vscode.AuthenticationSession = {
        id: newStoredSession.id,
        accessToken: newStoredSession.accessToken,
        account: newStoredSession.account,
        scopes: newStoredSession.scopes
      }

      this._onDidChangeSessions.fire({
        added: [session],
        removed: stored.map(s => ({
          id: s.id,
          accessToken: s.accessToken,
          account: s.account,
          scopes: s.scopes
        })),
        changed: []
      })

      pending.resolve(session)
    } catch (err) {
      pending.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private async refreshSessionToken(session: StoredSession): Promise<StoredSession> {
    const { address, clientId } = authentikConfig
    const endpoints = this.getEndpoints(address)
    const tokenUrl = endpoints.token

    const response = await ofetch<any>(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: session.refreshToken || ''
      }).toString()
    })

    return {
      ...session,
      accessToken: response.access_token,
      refreshToken: response.refresh_token || session.refreshToken,
      expiresAt: response.expires_in ? Date.now() + response.expires_in * 1000 : undefined
    }
  }

  private getEndpoints(baseAddress: string) {
    const address = baseAddress.endsWith('/') ? baseAddress : baseAddress + '/'
    
    if (address.includes('/authorize/')) {
      return {
        authorize: address,
        token: address.replace('/authorize/', '/token/'),
        userinfo: address.replace('/authorize/', '/userinfo/')
      }
    }

    return {
      authorize: joinURL(address, 'application/o/authorize/'),
      token: joinURL(address, 'application/o/token/'),
      userinfo: joinURL(address, 'application/o/userinfo/')
    }
  }

  async clearSessions(): Promise<void> {
    const sessions = await this.getStoredSessions()
    for (const session of sessions) {
      await this.removeSession(session.id)
    }
  }

  dispose() {
    this._uriHandlerDisposable.dispose()
    if (this._providerDisposable) {
      this._providerDisposable.dispose()
    }
  }
}
