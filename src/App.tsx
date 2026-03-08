import { useEffect, useMemo, useState } from 'react'
import './style.css'

interface GoogleUser {
  name: string
  email: string
  picture?: string
}

const STORAGE_KEY = 'googleUser'

interface GoogleJwtPayload {
  name?: string
  email?: string
  picture?: string
}

function parseGoogleUserFromCredential(credential: string | undefined): GoogleUser | null {
  if (!credential) {
    return null
  }

  try {
    const base64Payload = credential.split('.')[1]
    if (!base64Payload) {
      return null
    }

    const normalized = base64Payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized)
    const json = decodeURIComponent(
      Array.from(decoded)
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )

    const payload = JSON.parse(json) as GoogleJwtPayload

    if (!payload.email || !payload.name) {
      return null
    }

    return {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    }
  } catch {
    return null
  }
}

interface LoginViewProps {
  onSignedIn: (user: GoogleUser) => void
}

function LoginView({ onSignedIn }: LoginViewProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!clientId) {
      // eslint-disable-next-line no-console
      console.error('Missing VITE_GOOGLE_CLIENT_ID environment variable for Google Sign-In.')
      return
    }

    if (!buttonElement || !window.google?.accounts?.id) {
      return
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: unknown) => {
        const credential = (response as { credential?: string }).credential
        const user = parseGoogleUserFromCredential(credential)

        if (user) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
          onSignedIn(user)
        }
      },
    })

    window.google.accounts.id.renderButton(buttonElement, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      width: 260,
    })
  }, [buttonElement, clientId, onSignedIn])

  return (
    <div className="app app--unauthorized">
      <h1>Hello, World!</h1>
      <p>Sign in with Google to continue.</p>
      {!clientId ? (
        <p className="app__warning">
          Set <code>VITE_GOOGLE_CLIENT_ID</code> in your environment to enable Google Sign-In.
        </p>
      ) : (
        <div ref={setButtonElement} className="google-button-container" />
      )}
    </div>
  )
}

export function App() {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) {
        return null
      }
      return JSON.parse(saved) as GoogleUser
    } catch {
      return null
    }
  })

  const isAuthorized = useMemo(() => Boolean(user?.email), [user])

  const handleSignOut = () => {
    if (user?.email && window.google?.accounts?.id) {
      window.google.accounts.id.revoke(user.email, () => {
        // no-op
      })
    }

    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  if (!isAuthorized) {
    return <LoginView onSignedIn={setUser} />
  }

  return (
    <div className="app app--authorized">
      <header className="app-header">
        <div className="user-info">
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="user-avatar" />
          ) : (
            <div className="user-avatar user-avatar--fallback">
              {user.name
                .split(' ')
                .map((part) => part.charAt(0))
                .join('')
                .toUpperCase()}
            </div>
          )}
          <div className="user-text">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>
        </div>
        <button type="button" className="logout-button" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <main className="app-main">
        <h1>Hello, {user.name.split(' ')[0]}!</h1>
        <p>You are authorized with your Google account.</p>
        <p>Replace this section with your application&apos;s protected content.</p>
      </main>
    </div>
  )
}

