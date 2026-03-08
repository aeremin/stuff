export {}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: unknown) => void
          renderButton: (parent: HTMLElement, options: unknown) => void
          prompt: () => void
          revoke: (hint: string, callback: () => void) => void
        }
      }
    }
  }
}

