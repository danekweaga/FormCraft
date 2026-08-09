import type { SupabaseClient } from "@supabase/supabase-js";
import type { BudgetCheckResult } from "./types";

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getAiBudgets() {
  return {
    dailyUsd: numEnv("DAILY_AI_BUDGET_USD", 1),
    monthlyUsd: numEnv("MONTHLY_AI_BUDGET_USD", 10),
  };
}

export async function getSpendSince(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { data } = await supabase
    .from("ai_usage_events")
    .select("cost_usd, estimated_cost_usd")
    .eq("user_id", userId)
    .gte("created_at", sinceIso);

  let total = 0;
  for (const row of data ?? []) {
    const cost =
      (typeof row.cost_usd === "number" ? row.cost_usd : null) ??
      (typeof row.estimated_cost_usd === "number" ? row.estimated_cost_usd : 0);
    total += Number(cost) || 0;
  }
  return total;
}

export async function checkAiBudget(
  supabase: SupabaseClient,
  userId: string,
): Promise<BudgetCheckResult> {
  const budgets = getAiBudgets();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailySpend, monthlySpend] = await Promise.all([
    getSpendSince(supabase, userId, startOfDay.toISOString()),
    getSpendSince(supabase, userId, startOfMonth.toISOString()),
  ]);

  if (dailySpend >= budgets.dailyUsd) {
    return {
      ok: false,
      reason: "daily",
      spentUsd: dailySpend,
      budgetUsd: budgets.dailyUsd,
      message:
        "Daily AI budget reached. This request was not sent. Increase DAILY_AI_BUDGET_USD, use a cheaper model, or continue without AI.",
    };
  }
  if (monthlySpend >= budgets.monthlyUsd) {
    return {
      ok: false,
      reason: "monthly",
      spentUsd: monthlySpend,
      budgetUsd: budgets.monthlyUsd,
      message:
        "Monthly AI budget reached. This request was not sent. Increase MONTHLY_AI_BUDGET_USD, use a cheaper model, or continue without AI.",
    };
  }
  return { ok: true };
}

export class AiBudgetError extends Error {
  reason: "daily" | "monthly";
  constructor(result: Extract<BudgetCheckResult, { ok: false }>) {
    super(result.message);
    this.name = "AiBudgetError";
    this.reason = result.reason;
  }
}
