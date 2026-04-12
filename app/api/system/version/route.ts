import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || "KORE-SYSTEMS/Klient";
const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
}

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  let latest: {
    version: string;
    name: string;
    publishedAt: string;
    url: string;
    changelog: string;
  } | null = null;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        next: { revalidate: 300 }, // cache 5 min
      }
    );

    if (res.ok) {
      const release: GitHubRelease = await res.json();
      latest = {
        version: release.tag_name.replace(/^v/, ""),
        name: release.name,
        publishedAt: release.published_at,
        url: release.html_url,
        changelog: release.body || "",
      };
    }
  } catch {
    // GitHub unreachable — that's fine, we just won't show update info
  }

  const updateAvailable =
    latest !== null && latest.version !== CURRENT_VERSION;

  return NextResponse.json({
    current: CURRENT_VERSION,
    latest,
    updateAvailable,
  });
}
