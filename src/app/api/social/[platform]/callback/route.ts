import { NextResponse } from "next/server";
import { completeOwnedConnection } from "@/lib/social/complete-connection";
import { getAppUrl, getOAuthCallbackUrl } from "@/lib/social/config";
import {
  friendlyOAuthError,
  oauthProviderError,
} from "@/lib/social/oauth-errors";
import { parseOAuthState } from "@/lib/social/oauth-state";
import {
  getOwnedProvider,
  isOwnedPlatform,
} from "@/lib/social/providers";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ platform: string }> };

export async function GET(request: Request, { params }: Params) {
  const { platform } = await params;
  const origin = getAppUrl();

  if (!isOwnedPlatform(platform)) {
    return NextResponse.redirect(
      new URL("/connections?error=unsupported_platform", origin),
    );
  }

  const url = new URL(request.url);
  const providerError = oauthProviderError(url);
  if (providerError) {
    return NextResponse.redirect(
      new URL(
        `/connections?error=${encodeURIComponent(providerError)}`,
        origin,
      ),
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/connections?error=missing_oauth_params", origin),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/sign-in?next=/connections", origin),
    );
  }

  try {
    const payload = parseOAuthState(state, platform);
    if (payload.userId !== user.id) {
      throw new Error("OAuth state user mismatch");
    }

    const provider = getOwnedProvider(platform);
    const result = await provider.handleCallback({
      code,
      redirectUri: getOAuthCallbackUrl(platform),
      codeVerifier: payload.codeVerifier,
    });

    // Never return tokens to the browser — complete server-side only
    const { connectionId, jobId } = await completeOwnedConnection({
      userId: user.id,
      platform,
      result,
    });

    return NextResponse.redirect(
      new URL(
        `/connections?connected=${platform}&connection=${connectionId}&job=${jobId}`,
        origin,
      ),
    );
  } catch (error) {
    const message = friendlyOAuthError(
      error instanceof Error ? error.message : "OAuth callback failed",
    );
    return NextResponse.redirect(
      new URL(
        `/connections?error=${encodeURIComponent(message)}`,
        origin,
      ),
    );
  }
}
