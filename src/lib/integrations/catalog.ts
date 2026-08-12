import { isLlmConfigured } from "@/lib/ai/models/router";
import { isSupadataConfigured } from "@/lib/analyze/transcription/supadata-provider";
import { openAlexProvider } from "@/lib/psychology/providers/openalex";
import { isScrapeCreatorsConfigured } from "@/lib/research/discovery/scrapecreators-client";
import { isTiktokDataApiConfigured } from "@/lib/research/discovery/tiktok-data-provider";
import { isYoutubeDiscoveryConfigured } from "@/lib/research/discovery/youtube-provider";
import { isPlatformConfigured } from "@/lib/social/config";

export type IntegrationStatus = "connected" | "missing" | "optional";

export type AppIntegration = {
  id: string;
  name: string;
  category: "research" | "ai" | "accounts" | "platform";
  purpose: string;
  envVars: string[];
  docsUrl?: string;
  status: IntegrationStatus;
  detail: string;
};

function envOn(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function listAppIntegrations(): AppIntegration[] {
  const scrapeOn = isScrapeCreatorsConfigured();
  const youtubeSearchOn = isYoutubeDiscoveryConfigured();
  const tiktokStoreOn = isTiktokDataApiConfigured();
  const openrouterOn = isLlmConfigured();
  const supadataOn = isSupadataConfigured();
  const openalexOn = openAlexProvider.isConfigured();
  const supabaseOn = envOn("NEXT_PUBLIC_SUPABASE_URL");
  const whisperOn = envOn("OPENAI_API_KEY");

  return [
    {
      id: "supabase",
      name: "Supabase",
      category: "platform",
      purpose: "Auth, database, and file storage for the whole app.",
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      docsUrl: "https://supabase.com/dashboard",
      status: supabaseOn ? "connected" : "missing",
      detail: supabaseOn ? "Project URL is set." : "Add NEXT_PUBLIC_SUPABASE_URL.",
    },
    {
      id: "scrapecreators",
      name: "ScrapeCreators",
      category: "research",
      purpose:
        "Public TikTok, Instagram Reels, and YouTube search. 1 request = 1 credit.",
      envVars: ["SCRAPECREATORS_API_KEY"],
      docsUrl: "https://docs.scrapecreators.com",
      status: scrapeOn ? "connected" : "missing",
      detail: scrapeOn
        ? "Used for TikTok + Instagram discovery (YouTube stays on the official API when that key is set)."
        : "Add SCRAPECREATORS_API_KEY to pull TikTok and Instagram.",
    },
    {
      id: "youtube-data",
      name: "YouTube Data API",
      category: "research",
      purpose: "Official public YouTube / Shorts search. Uses Google quota, not ScrapeCreators credits.",
      envVars: ["YOUTUBE_DATA_API_KEY"],
      docsUrl: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
      status: youtubeSearchOn ? "connected" : "missing",
      detail: youtubeSearchOn
        ? "Preferred YouTube source."
        : "Add YOUTUBE_DATA_API_KEY, or ScrapeCreators will cover YouTube instead.",
    },
    {
      id: "tiktokapi-store",
      name: "TikTokAPI.store",
      category: "research",
      purpose: "Fallback TikTok search if ScrapeCreators is not configured.",
      envVars: ["TIKTOK_DATA_API_KEY"],
      docsUrl: "https://tiktokapi.store",
      status: scrapeOn
        ? tiktokStoreOn
          ? "optional"
          : "optional"
        : tiktokStoreOn
          ? "connected"
          : "optional",
      detail: scrapeOn
        ? "On standby. ScrapeCreators is the live TikTok source."
        : tiktokStoreOn
          ? "Active TikTok source."
          : "Optional fallback. Prefer SCRAPECREATORS_API_KEY.",
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      category: "ai",
      purpose: "Hooks, analysis, briefs, and other LLM work.",
      envVars: ["OPENROUTER_API_KEY"],
      docsUrl: "https://openrouter.ai/keys",
      status: openrouterOn ? "connected" : "missing",
      detail: openrouterOn ? "AI routes are live." : "Add OPENROUTER_API_KEY.",
    },
    {
      id: "supadata",
      name: "Supadata",
      category: "ai",
      purpose: "On-demand transcripts for public TikTok, Instagram, and YouTube links.",
      envVars: ["SUPADATA_API_KEY"],
      docsUrl: "https://supadata.ai",
      status: supadataOn ? "connected" : "optional",
      detail: supadataOn
        ? "Analyze can fetch spoken transcripts from public URLs."
        : "Optional. Paste a transcript if this key is missing.",
    },
    {
      id: "openalex",
      name: "OpenAlex",
      category: "ai",
      purpose: "Scholarly psychology paper search.",
      envVars: ["OPENALEX_API_KEY"],
      docsUrl: "https://openalex.org/settings/api",
      status: openalexOn ? "connected" : "optional",
      detail: openalexOn
        ? "Psychology discovery can search papers."
        : "Optional free key for scholarly search.",
    },
    {
      id: "openai-whisper",
      name: "OpenAI Whisper",
      category: "ai",
      purpose: "Transcribe uploaded audio/video files.",
      envVars: ["OPENAI_API_KEY"],
      docsUrl: "https://platform.openai.com/api-keys",
      status: whisperOn ? "connected" : "optional",
      detail: whisperOn
        ? "File uploads can be transcribed with Whisper."
        : "Optional. Not required when Supadata or a pasted transcript is used.",
    },
    {
      id: "instagram-oauth",
      name: "Instagram (owned account)",
      category: "accounts",
      purpose: "Connect your professional Instagram account for your own metrics.",
      envVars: ["META_APP_ID", "META_APP_SECRET"],
      docsUrl: "/connections",
      status: isPlatformConfigured("instagram") ? "connected" : "missing",
      detail: isPlatformConfigured("instagram")
        ? "OAuth app is configured. Connect the account under Connections."
        : "Add META_APP_ID and META_APP_SECRET, then connect under Connections.",
    },
    {
      id: "youtube-oauth",
      name: "YouTube (owned account)",
      category: "accounts",
      purpose: "Connect your YouTube channel for your own analytics.",
      envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      docsUrl: "/connections",
      status: isPlatformConfigured("youtube") ? "connected" : "missing",
      detail: isPlatformConfigured("youtube")
        ? "OAuth app is configured. Connect the channel under Connections."
        : "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then connect under Connections.",
    },
    {
      id: "tiktok-oauth",
      name: "TikTok (owned account)",
      category: "accounts",
      purpose: "Connect your TikTok account via Login Kit for your own stats.",
      envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
      docsUrl: "/connections",
      status: isPlatformConfigured("tiktok") ? "connected" : "missing",
      detail: isPlatformConfigured("tiktok")
        ? "Login Kit is configured. Connect the account under Connections."
        : "Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET, then connect under Connections.",
    },
  ];
}

export function integrationCounts(items: AppIntegration[]) {
  return {
    connected: items.filter((i) => i.status === "connected").length,
    missing: items.filter((i) => i.status === "missing").length,
    optional: items.filter((i) => i.status === "optional").length,
    total: items.length,
  };
}
