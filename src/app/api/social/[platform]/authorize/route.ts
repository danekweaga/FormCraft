import { NextResponse } from "next/server";
import { getOAuthCallbackUrl } from "@/lib/social/config";
import { createOAuthState, createPkcePair } from "@/lib/social/oauth-state";
import {
  getOwnedProvider,
  isOwnedPlatform,
} from "@/lib/social/providers";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ platform: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { platform } = await params;
  if (!isOwnedPlatform(platform)) {
    return NextResponse.redirect(
      new URL("/connections?error=unsupported_platform", await appOrigin()),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?next=${encodeURIComponent(`/api/social/${platform}/authorize`)}`,
        await appOrigin(),
      ),
    );
  }

  const provider = getOwnedProvider(platform);
  if (!provider.isConfigured()) {
    return NextResponse.redirect(
      new URL(
        `/connections?error=${encodeURIComponent(provider.unconfiguredReason() ?? "not_configured")}`,
        await appOrigin(),
      ),
    );
  }

  try {
    const pkce =
      platform === "tiktok" || platform === "youtube"
        ? createPkcePair()
        : null;
    const state = createOAuthState({
      userId: user.id,
      platform,
      codeVerifier: pkce?.codeVerifier,
    });
    const url = await provider.getAuthorizationUrl({
      userId: user.id,
      redirectUri: getOAuthCallbackUrl(platform),
      state,
      codeVerifier: pkce?.codeVerifier,
      codeChallenge: pkce?.codeChallenge,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authorization start failed";
    return NextResponse.redirect(
      new URL(
        `/connections?error=${encodeURIComponent(message)}`,
        await appOrigin(),
      ),
    );
  }
}

async function appOrigin() {
  const { getAppUrl } = await import("@/lib/social/config");
  return getAppUrl();
}
