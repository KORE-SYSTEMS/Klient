declare module "puppeteer" {
  export interface LaunchOptions {
    headless?: boolean | "new";
    executablePath?: string;
    args?: string[];
    [key: string]: unknown;
  }

  export interface PDFOptions {
    format?: string;
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
    [key: string]: unknown;
  }

  export interface CookieParam {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    [key: string]: unknown;
  }

  export interface Page {
    goto(url: string, options?: { waitUntil?: string | string[]; timeout?: number }): Promise<unknown>;
    pdf(options?: PDFOptions): Promise<Buffer>;
    close(): Promise<void>;
    setViewport(viewport: { width: number; height: number }): Promise<void>;
    setCookie(...cookies: CookieParam[]): Promise<void>;
  }

  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export function launch(options?: LaunchOptions): Promise<Browser>;
}
