import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getAiBudgets } from "@/lib/ai/budget";
import { buildFormCraftContext } from "@/lib/ai/context/formcraft-context";
import { isLlmConfigured, resolveModelName } from "@/lib/ai/models/router";
import { createClient } from "@/lib/supabase/server";

export default async function ContextDebuggerPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; q?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    redirect("/today");
  }

  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const taskType =
    (params.task as "today_recommendation") || "today_recommendation";
  const context = await buildFormCraftContext(supabase, {
    userId: user.id,
    taskType,
    query: params.q ?? "what should I make next",
  });
  const budgets = getAiBudgets();

  return (
    <div>
      <PageHeader
        title="Context debugger"
        description="Development-only inspector for unified FormCraft context. Credentials never appear here."
      />
      <pre className="overflow-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 text-xs leading-relaxed">
        {JSON.stringify(
          {
            taskType: context.taskType,
            provider: isLlmConfigured() ? "openrouter" : "heuristic_fallback",
            modelTier: context.modelTier,
            modelSelected:
              "modelName" in context && typeof context.modelName === "string"
                ? context.modelName
                : resolveModelName(context.modelTier),
            estimatedTokens: context.estimatedTokens,
            budgetTokens: context.budgetTokens,
            aiSpendBudgetsUsd: budgets,
            usedFrom: context.usedFrom,
            debug: context.debug,
            excluded: context.excluded,
            provenance: context.provenance,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
