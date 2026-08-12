import type {
  ContentDiscoveryProvider,
  CreatorPostsInput,
  DiscoveryCapabilities,
  SearchPostResult,
} from "./types";
import {
  isScrapeCreatorsConfigured,
} from "./scrapecreators-client";
import { scrapeCreatorsDiscoveryProvider } from "./scrapecreators-provider";

const GRAPH_HOST = "graph.facebook.com";
const DEFAULT_GRAPH_VERSION = "v26.0";
const USERNAME_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const MAX_PAGES = 3;

type MetaGraphErrorBody = {
  error?: {
    message?: unknown;
    code?: unknown;
    error_subcode?: unknown;
  };
};

type MetaMedia = {
  id?: unknown;
  caption?: unknown;
  media_type?: unknown;
  media_product_type?: unknown;
  permalink?: unknown;
  timestamp?: unknown;
  like_count?: unknown;
  comments_count?: unknown;
  thumbnail_url?: unknown;
};

type MetaMediaPage = {
  data?: unknown;
  paging?: {
    next?: unknown;
  };
};

type MetaBusinessDiscovery = {
  id?: unknown;
  username?: unknown;
  name?: unknown;
  followers_count?: unknown;
  media?: MetaMediaPage;
};

type MetaDiscoveryResponse = MetaGraphErrorBody & {
  business_discovery?: MetaBusinessDiscovery;
  data?: unknown;
  paging?: MetaMediaPage["paging"];
};

class MetaInstagramDiscoveryError extends Error {
  readonly graphCode: number | null;

  constructor(message: string, graphCode: number | null = null) {
    super(message);
    this.name = "MetaInstagramDiscoveryError";
    this.graphCode = graphCode;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asMediaList(value: unknown): MetaMedia[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is MetaMedia => Boolean(item && typeof item === "object"),
      )
    : [];
}

function graphVersion(): string {
  const configured =
    process.env.META_BUSINESS_DISCOVERY_GRAPH_API_VERSION?.trim();
  return /^v\d+\.\d+$/.test(configured ?? "")
    ? (configured as string)
    : DEFAULT_GRAPH_VERSION;
}

function accessToken(): string {
  const token = process.env.META_BUSINESS_DISCOVERY_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new MetaInstagramDiscoveryError(
      "Meta Instagram Business Discovery is not configured.",
    );
  }
  return token;
}

function connectedInstagramId(): string {
  const id = process.env.META_BUSINESS_DISCOVERY_IG_USER_ID?.trim();
  if (!id || !/^\d+$/.test(id)) {
    throw new MetaInstagramDiscoveryError(
      "META_BUSINESS_DISCOVERY_IG_USER_ID is missing or invalid.",
    );
  }
  return id;
}

export function isMetaInstagramDiscoveryConfigured(): boolean {
  return Boolean(
    process.env.META_BUSINESS_DISCOVERY_ACCESS_TOKEN?.trim() &&
      /^\d+$/.test(
        process.env.META_BUSINESS_DISCOVERY_IG_USER_ID?.trim() ?? "",
      ),
  );
}

export function getMetaInstagramDiscoveryStatus(now = Date.now()): {
  configured: boolean;
  expiresAt: string | null;
  expired: boolean;
  daysRemaining: number | null;
} {
  const expiresAt =
    process.env.META_BUSINESS_DISCOVERY_TOKEN_EXPIRES_AT?.trim() || null;
  const expiryMs = expiresAt
    ? new Date(`${expiresAt}T23:59:59.999Z`).getTime()
    : Number.NaN;
  const validExpiry = Number.isFinite(expiryMs);
  return {
    configured: isMetaInstagramDiscoveryConfigured(),
    expiresAt,
    expired: validExpiry ? expiryMs <= now : false,
    daysRemaining: validExpiry
      ? Math.max(0, Math.ceil((expiryMs - now) / 86_400_000))
      : null,
  };
}

export function normalizeInstagramUsername(value: string): string | null {
  const trimmed = value.trim();
  let candidate = trimmed.replace(/^@/, "");
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
    }
  } catch {
    return null;
  }
  candidate = candidate.replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  return USERNAME_PATTERN.test(candidate) ? candidate : null;
}

function safeGraphUrl(input: string): URL {
  const url = new URL(input, `https://${GRAPH_HOST}/${graphVersion()}/`);
  if (url.protocol !== "https:" || url.hostname !== GRAPH_HOST) {
    throw new MetaInstagramDiscoveryError(
      "Meta returned an invalid pagination URL.",
    );
  }
  // Meta sometimes repeats the token in nested pagination URLs. Always remove
  // it and authenticate with the server-only Authorization header instead.
  url.searchParams.delete("access_token");
  return url;
}

async function graphGet(input: string): Promise<MetaDiscoveryResponse> {
  const url = safeGraphUrl(input);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as MetaDiscoveryResponse;
  if (!response.ok || body.error) {
    const code = asNumber(body.error?.code);
    console.error("[meta-instagram-discovery] request failed", {
      status: response.status,
      graphCode: code,
      graphSubcode: asNumber(body.error?.error_subcode),
    });
    const graphMessage = (
      asString(body.error?.message) ?? "Meta request failed"
    ).replaceAll(accessToken(), "[redacted]");
    throw new MetaInstagramDiscoveryError(graphMessage, code);
  }
  return body;
}

function discoveryFields(username: string, limit: number, assets = true): string {
  const mediaFields = [
    "id",
    "caption",
    "media_type",
    "media_product_type",
    "permalink",
    "timestamp",
    "like_count",
    "comments_count",
    ...(assets ? ["thumbnail_url"] : []),
  ].join(",");
  return `business_discovery.username(${username}){id,username,name,followers_count,media_count,media.limit(${limit}){${mediaFields}}}`;
}

function firstRequestUrl(username: string, limit: number, assets = true): string {
  const url = safeGraphUrl(connectedInstagramId());
  url.searchParams.set("fields", discoveryFields(username, limit, assets));
  return url.toString();
}

function normalizeMedia(params: {
  item: MetaMedia;
  username: string;
  displayName: string | null;
  followerCount: number | null;
  retrievedAt: string;
}): SearchPostResult | null {
  const id = asString(params.item.id);
  const permalink = asString(params.item.permalink);
  const productType = asString(params.item.media_product_type)?.toUpperCase();
  const mediaType = asString(params.item.media_type)?.toUpperCase();
  if (!id || !permalink) return null;
  if (productType !== "REELS" && mediaType !== "VIDEO") return null;
  const caption = asString(params.item.caption);

  return {
    platform: "instagram",
    externalId: id,
    externalUrl: permalink,
    // Keep the stable watchlist handle as the creator key. Using Meta's
    // numeric discovery id here would create a duplicate creator row.
    creatorId: params.username,
    creatorName: params.displayName ?? params.username,
    title: caption,
    description: caption,
    thumbnailUrl: asString(params.item.thumbnail_url),
    publishedAt: asString(params.item.timestamp),
    durationSeconds: null,
    // Business Discovery exposes public engagement, but not competitors'
    // Reel plays. Do not relabel engagement as views.
    views: null,
    likes: asNumber(params.item.like_count),
    comments: asNumber(params.item.comments_count),
    shares: null,
    providerName: "meta_instagram_business_discovery",
    collectionMethod: "official_business_discovery",
    retrievedAt: params.retrievedAt,
    creatorFollowerCount: params.followerCount,
  };
}

async function getMetaCreatorPosts(
  input: CreatorPostsInput,
): Promise<SearchPostResult[]> {
  const username = normalizeInstagramUsername(input.platformCreatorId);
  if (!username) {
    throw new MetaInstagramDiscoveryError(
      "Instagram creator must be a valid username or profile URL.",
    );
  }
  const maxResults = Math.min(50, Math.max(1, input.maxResults ?? 30));
  const retrievedAt = new Date().toISOString();

  let first: MetaDiscoveryResponse;
  try {
    first = await graphGet(firstRequestUrl(username, maxResults, true));
  } catch (error) {
    // Some Graph versions/accounts do not expose thumbnail_url through nested
    // Business Discovery. Retry the proven minimal contract before failing.
    if (
      error instanceof MetaInstagramDiscoveryError &&
      error.graphCode === 100
    ) {
      first = await graphGet(firstRequestUrl(username, maxResults, false));
    } else {
      throw error;
    }
  }

  const discovery = first.business_discovery;
  if (!discovery) {
    throw new MetaInstagramDiscoveryError(
      `Meta could not discover @${username}. The account must be public and professional (Business or Creator).`,
    );
  }

  const canonicalUsername = asString(discovery.username) ?? username;
  const displayName = asString(discovery.name);
  const followerCount = asNumber(discovery.followers_count);
  const results: SearchPostResult[] = [];
  let page: MetaMediaPage | undefined = discovery.media;

  for (let pageIndex = 0; page && pageIndex < MAX_PAGES; pageIndex += 1) {
    for (const item of asMediaList(page.data)) {
      const normalized = normalizeMedia({
        item,
        username: canonicalUsername,
        displayName,
        followerCount,
        retrievedAt,
      });
      if (normalized) results.push(normalized);
      if (results.length >= maxResults) return results;
    }

    const next = asString(page.paging?.next);
    if (!next || results.length >= maxResults) break;
    const nextBody = await graphGet(next);
    page = nextBody.business_discovery?.media ?? {
      data: nextBody.data,
      paging: nextBody.paging,
    };
  }

  return results.slice(0, maxResults);
}

export const metaInstagramDiscoveryProvider: ContentDiscoveryProvider = {
  providerName: "meta_instagram_business_discovery",

  capabilities(): DiscoveryCapabilities {
    const configured = isMetaInstagramDiscoveryConfigured();
    return {
      // Business Discovery is username-based; it is not a keyword search API.
      searchPosts: false,
      searchCreators: false,
      getCreatorPosts: configured,
      refreshMetrics: false,
      getCreatorBaseline: false,
      platforms: configured ? ["instagram"] : [],
      providerType: "official",
    };
  },

  async searchPosts(): Promise<SearchPostResult[]> {
    return [];
  },

  async getCreatorPosts(input: CreatorPostsInput): Promise<SearchPostResult[]> {
    if (!isMetaInstagramDiscoveryConfigured() || input.platform !== "instagram") {
      return [];
    }
    try {
      return await getMetaCreatorPosts(input);
    } catch (error) {
      if (
        isScrapeCreatorsConfigured() &&
        scrapeCreatorsDiscoveryProvider.getCreatorPosts
      ) {
        console.warn(
          "[meta-instagram-discovery] official pull failed; using configured fallback",
          {
            errorName: error instanceof Error ? error.name : "unknown",
          },
        );
        return scrapeCreatorsDiscoveryProvider.getCreatorPosts(input);
      }
      throw error;
    }
  },
};
