import { readFileSync, existsSync } from "fs";

// Version priority: VERSION file (from git tag) > package.json
let appVersion;
if (existsSync("./VERSION")) {
  appVersion = readFileSync("./VERSION", "utf8").trim();
} else {
  const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
  appVersion = pkg.version;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Puppeteer darf nicht von Webpack gebundelt werden (binäre Chromium-Files).
  serverExternalPackages: ["puppeteer", "puppeteer-core"],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_GITHUB_REPO: "KORE-SYSTEMS/Klient",
  },
};

export default nextConfig;
