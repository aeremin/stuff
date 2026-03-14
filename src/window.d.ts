export {}

interface NDEFScanOptions {
  signal: AbortSignal;
}

interface NDEFWriteOptions {
  overwrite: boolean;
  signal?: AbortSignal;
}

interface NDEFRecord {
  data?: string | ArrayBuffer | DataView | {records: Array<NDEFRecord>}
  encoding?: string
  id?: string
  lang?: string
  mediaType?: string
  recordType: "absolute-url" | "empty" | "mime" | "smart-poster" | "text" | "unknown" | "url"
}

type NDEFMessage = string | ArrayBuffer | DataView | {records: Array<NDEFRecord>}

declare class NDEFReader extends EventTarget {
  constructor();
  onreading: (this: this, event: Event) => any;
  onreadingerror: (this: this, error: Event) => any;
  scan: (options?: NDEFScanOptions) => Promise<void>;
  write: (
      message: NDEFMessage,
      options?: NDEFWriteOptions,
  ) => Promise<void>;
}

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
    NDEFReader: typeof NDEFReader
  }
}

