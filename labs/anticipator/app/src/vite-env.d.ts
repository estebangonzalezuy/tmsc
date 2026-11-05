/// <reference types="vite/client" />

declare global {
  interface Window {
    __editor?: { time: () => number; project: () => unknown; control: () => unknown };
    __render?: {
      ready: boolean;
      load: (p: import("@core/types.ts").Project) => { duration: number; missing: string[] };
      renderAt: (ms: number) => void;
      frame: () => string;
    };
  }
}
export {};
