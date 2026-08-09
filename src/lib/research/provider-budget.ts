export type DiscoveryBudgets = {
  dailyCalls: number;
  monthlyCalls: number;
  maxResultsPerQuery: number;
  maxTrackedCreators: number;
  autoDeepAnalysis: boolean;
};

export function getDiscoveryBudgets(): DiscoveryBudgets {
  return {
    dailyCalls: Number(process.env.DISCOVERY_DAILY_CALL_BUDGET ?? "50") || 50,
    monthlyCalls: Number(process.env.DISCOVERY_MONTHLY_CALL_BUDGET ?? "500") || 500,
    maxResultsPerQuery:
      Number(process.env.DISCOVERY_MAX_RESULTS_PER_QUERY ?? "25") || 25,
    maxTrackedCreators:
      Number(process.env.DISCOVERY_MAX_TRACKED_CREATORS ?? "50") || 50,
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
