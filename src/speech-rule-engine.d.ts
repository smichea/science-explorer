declare module 'speech-rule-engine' {
  export function engineReady(): Promise<unknown>;
  export function setupEngine(options: Record<string, unknown>): Promise<unknown>;
  export function toSpeech(mathml: string): string;
  const engine: {
    engineReady(): Promise<unknown>;
    setupEngine(options: Record<string, unknown>): Promise<unknown>;
    toSpeech(mathml: string): string;
  };
  export default engine;
}
