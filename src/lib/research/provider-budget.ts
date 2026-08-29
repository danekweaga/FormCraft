export type DiscoveryBudgets = {
  dailyCalls: number;
  monthlyCalls: number;
  maxResultsPerQuery: number;
  autoDeepAnalysis: boolean;
};

export type BudgetedDiscoveryPlatform = "instagram" | "tiktok";

export type DiscoveryUsageEvent = {
  provider: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** Providers whose requests consume paid credits or a scarce search quota. */
export const BUDGETED_DISCOVERY_PROVIDERS = [
  "scrapecreators",
  "tiktokapi_store",
] as const;

export const BUDGETED_DISCOVERY_PLATFORMS = [
  "instagram",
  "tiktok",
] as const satisfies readonly BudgetedDiscoveryPlatform[];

/** Operations that belong to discovery; transcript/AI usage is budgeted elsewhere. */
export const DISCOVERY_BUDGET_OPERATIONS = [
  "search_posts",
  "get_creator_posts",
] as const;

export function isDiscoveryProviderBudgeted(providerName: string): boolean {
  return (BUDGETED_DISCOVERY_PROVIDERS as readonly string[]).includes(
    providerName,
  );
}

export function isBudgetedDiscoveryPlatform(
  platform: string,
): platform is BudgetedDiscoveryPlatform {
  return (BUDGETED_DISCOVERY_PLATFORMS as readonly string[]).includes(platform);
}

export function remainingDiscoveryCalls(params: {
  callsToday: number;
  callsMonth: number;
  budgets?: DiscoveryBudgets;
}): number {
  const budgets = params.budgets ?? getDiscoveryBudgets();
  return Math.max(
    0,
    Math.min(
      budgets.dailyCalls - params.callsToday,
      budgets.monthlyCalls - params.callsMonth,
    ),
  );
}

export function getDiscoveryBudgets(): DiscoveryBudgets {
  return {
    dailyCalls: Number(process.env.DISCOVERY_DAILY_CALL_BUDGET ?? "50") || 50,
    monthlyCalls: Number(process.env.DISCOVERY_MONTHLY_CALL_BUDGET ?? "500") || 500,
    maxResultsPerQuery:
      Number(process.env.DISCOVERY_MAX_RESULTS_PER_QUERY ?? "50") || 50,
    autoDeepAnalysis: process.env.DISCOVERY_AUTO_DEEP_ANALYSIS === "1",
  };
}

/**
 * Split the shared discovery allowance between the only two live platforms.
 * Instagram receives 70%; TikTok receives the remaining 30%.
 */
export function getDiscoveryBudgetsForPlatform(
  platform: BudgetedDiscoveryPlatform,
  budgets: DiscoveryBudgets = getDiscoveryBudgets(),
): DiscoveryBudgets {
  const instagramPercent = Math.min(
    100,
    Math.max(
      0,
      Number(process.env.DISCOVERY_INSTAGRAM_BUDGET_PERCENT ?? "70") || 70,
    ),
  );
  const percent = platform === "instagram" ? instagramPercent : 100 - instagramPercent;
  return {
    ...budgets,
    dailyCalls: Math.floor((budgets.dailyCalls * percent) / 100),
    monthlyCalls: Math.floor((budgets.monthlyCalls * percent) / 100),
  };
}

export function discoveryPlatformForUsageEvent(
  event: Pick<DiscoveryUsageEvent, "provider" | "metadata">,
): BudgetedDiscoveryPlatform | null {
  const platform = String(event.metadata?.platform ?? "").toLowerCase();
  if (isBudgetedDiscoveryPlatform(platform)) return platform;
  if (event.provider === "tiktokapi_store") return "tiktok";
  return null;
}

export function countDiscoveryUsageByPlatform(params: {
  events: DiscoveryUsageEvent[];
  dayStartIso: string;
}): Record<BudgetedDiscoveryPlatform, { callsToday: number; callsMonth: number }> {
  const usage = {
    instagram: { callsToday: 0, callsMonth: 0 },
    tiktok: { callsToday: 0, callsMonth: 0 },
  } satisfies Record<
    BudgetedDiscoveryPlatform,
    { callsToday: number; callsMonth: number }
  >;
  for (const event of params.events) {
    const platform = discoveryPlatformForUsageEvent(event);
    if (!platform) continue;
    usage[platform].callsMonth += 1;
    if (event.created_at >= params.dayStartIso) {
      usage[platform].callsToday += 1;
    }
  }
  return usage;
}

export function remainingDiscoveryCallsByPlatform(params: {
  usage: Record<
    BudgetedDiscoveryPlatform,
    { callsToday: number; callsMonth: number }
  >;
  budgets?: DiscoveryBudgets;
}): Record<BudgetedDiscoveryPlatform, number> {
  const budgets = params.budgets ?? getDiscoveryBudgets();
  return {
    instagram: remainingDiscoveryCalls({
      ...params.usage.instagram,
      budgets: getDiscoveryBudgetsForPlatform("instagram", budgets),
    }),
    tiktok: remainingDiscoveryCalls({
      ...params.usage.tiktok,
      budgets: getDiscoveryBudgetsForPlatform("tiktok", budgets),
    }),
  };
}

export function providerBudgetAllows(params: {
  callsToday: number;
  callsMonth: number;
  budgets?: DiscoveryBudgets;
}): { ok: true } | { ok: false; message: string } {
  const budgets = params.budgets ?? getDiscoveryBudgets();
  if (params.callsToday >= budgets.dailyCalls) {
    return {
      ok: false,
      message:
        "Daily discovery provider budget reached. This request was not sent.",
    };
  }
  if (params.callsMonth >= budgets.monthlyCalls) {
    return {
      ok: false,
      message:
        "Monthly discovery provider budget reached. This request was not sent.",
    };
  }
  return { ok: true };
}
