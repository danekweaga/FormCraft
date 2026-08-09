import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOpenRouterModels } from "@/lib/ai/models/catalog";
import { getTaskModelPreferences } from "@/lib/ai/models/preferences";
import { isLlmConfigured, resolveModelName } from "@/lib/ai/models/router";
import {
  TASK_DEFINITIONS,
  TASK_MODEL_TIER,
  type ContextTaskType,
} from "@/lib/ai/models/types";
import { createClient } from "@/lib/supabase/server";
import { ModelSettingsForm } from "./model-settings-form";

export default async function ModelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [preferences, catalog] = await Promise.all([
    getTaskModelPreferences(supabase, user.id),
    getOpenRouterModels(),
  ]);
  const assignments = Object.fromEntries(
    TASK_DEFINITIONS.map((task) => [
      task.taskType,
      preferences[task.taskType] ?? resolveModelName(TASK_MODEL_TIER[task.taskType]),
    ]),
  ) as Record<ContextTaskType, string>;
  const models = catalog.slice(0, 200).map((model) => ({
    id: model.id,
    name: model.name,
    contextLength: model.contextLength,
    promptPricePerMillion: model.promptPricePerMillion,
    completionPricePerMillion: model.completionPricePerMillion,
  }));

  return (
    <div>
      <PageHeader
        title="AI models"
        description="Route every FormCraft AI task through the OpenRouter model you choose. Assignments are personal to your account."
      />

      <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
        <CardHeader>
          <CardTitle>OpenRouter task routing</CardTitle>
          <CardDescription>
            Choose faster, cheaper models for automation and stronger models for deep creative work. Existing heuristic fallbacks remain active when AI is unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModelSettingsForm
            configured={isLlmConfigured()}
            assignments={assignments}
            models={models}
          />
        </CardContent>
      </Card>
    </div>
  );
}
