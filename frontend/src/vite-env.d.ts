/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

/** Moteur / core (alias Vite `@engine` → ../core). */
declare module '@engine/campaignHardModifiers.js' {
  export function getHardChapterModifierLabelsFr(chapter: number): string[];
}
