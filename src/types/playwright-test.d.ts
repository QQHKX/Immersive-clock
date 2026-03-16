declare module "@playwright/test" {
  export interface PlaywrightTestConfig {
    testDir?: string;
    fullyParallel?: boolean;
    timeout?: number;
    expect?: {
      timeout?: number;
    };
    reporter?: unknown;
    use?: Record<string, unknown>;
    webServer?: Record<string, unknown>;
    projects?: Array<Record<string, unknown>>;
  }

  export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;
}
