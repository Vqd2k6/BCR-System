/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __metro2_react_root__?: import('react-dom/client').Root;
  __metro2_dev_reporter_initialized?: boolean;
  __triggerTestError?: (msg?: string) => void;
  __reportDevError?: (payload: import('./services/devErrorReporter').DevErrorPayload) => Promise<void>;
}
