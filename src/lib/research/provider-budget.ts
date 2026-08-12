export type DiscoveryBudgets = {
  dailyCalls: number;
  monthlyCalls: number;
  maxResultsPerQuery: number;
  autoDeepAnalysis: boolean;
};

/** Providers whose requests consume paid credits or a scarce search quota. */
export const BUDGETED_DISCOVERY_PROVIDERS = [
  "scrapecreators",
  "youtube_data_api",
  "tiktokapi_store",
] as const;

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
