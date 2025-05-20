/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GROQ_API_KEY?: string // Optional as it might not be set for server-side only
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 