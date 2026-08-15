"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TASK_DEFINITIONS,
  TASK_MODEL_TIER,
  type ContextTaskType,
} from "@/lib/ai/models/types";
import {
  saveModelPreferences,
  resetModelPreferencesToDefaults,
  testOpenRouterModel,
  type ModelSettingsState,
} from "./actions";
import { DEFAULT_OPENROUTER_MODELS } from "@/lib/ai/models/router";

type ModelOption = {
  id: string;
  name: string;
  contextLength: number | null;
  promptPricePerMillion: number | null;
  completionPricePerMillion: number | null;
};

const initialState: ModelSettingsState = {};
const groups = ["Analysis", "Creation", "Strategy", "Automation"] as const;

function priceLabel(model: ModelOption): string {
  const input = model.promptPricePerMillion;
  const output = model.completionPricePerMillion;
  if (input === null || output === null) return "pricing unavailable";
  if (input === 0 && output === 0) return "free";
  return `$${input.toFixed(input < 1 ? 2 : 0)} in / $${output.toFixed(output < 1 ? 2 : 0)} out per 1M`;
}

export function ModelSettingsForm({
  configured,
  assignments,
  models,
}: {
  configured: boolean;
  assignments: Record<ContextTaskType, string>;
  models: ModelOption[];
}) {
  const [saveState, saveAction, savePending] = useActionState(
    saveModelPreferences,
    initialState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetModelPreferencesToDefaults,
    initialState,
  );
  const [testState, testAction, testPending] = useActionState(
    testOpenRouterModel,
    initialState,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
        <p className="font-semibold text-on-background">FormCraft defaults</p>
        <p className="mt-1 text-sm text-secondary">
          Unless you override a task below, routing uses these OpenRouter models
          by tier — not “everything on Gemini.”
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
          <li>
            <span className="font-semibold">Cheap</span>
            <p className="text-xs text-secondary break-all">
              {DEFAULT_OPENROUTER_MODELS.cheap}
            </p>
          </li>
          <li>
            <span className="font-semibold">Standard</span>
            <p className="text-xs text-secondary break-all">
              {DEFAULT_OPENROUTER_MODELS.standard}
            </p>
          </li>
          <li>
            <span className="font-semibold">Premium</span>
            <p className="text-xs text-secondary break-all">
              {DEFAULT_OPENROUTER_MODELS.premium}
            </p>
          </li>
        </ul>
        <form action={resetAction} className="mt-4">
          <Button type="submit" variant="outline" disabled={resetPending}>
            {resetPending ? "Resetting…" : "Reset all tasks to defaults"}
          </Button>
        </form>
        {resetState.success ? (
          <p className="mt-2 text-sm text-primary-container">{resetState.success}</p>
        ) : null}
        {resetState.error ? (
          <p className="mt-2 text-sm text-error">{resetState.error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-on-background">OpenRouter connection</p>
            <p className="mt-1 text-sm text-secondary">
              The key stays on the server. Models and prompts are never exposed in the browser as credentials.
            </p>
          </div>
          <Badge variant={configured ? "success" : "warning"}>
            {configured ? "API key configured" : "API key missing"}
          </Badge>
        </div>

        <form action={testAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(180px,0.4fr)_minmax(260px,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="test-task">Test task</Label>
            <select
              id="test-task"
              name="taskType"
              defaultValue="content_analysis"
              className="h-10 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm text-on-background"
            >
              {TASK_DEFINITIONS.map((task) => (
                <option key={task.taskType} value={task.taskType}>{task.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-model">Model</Label>
            <Input
              id="test-model"
              name="modelName"
              list="openrouter-model-catalog"
              defaultValue={assignments.content_analysis}
              placeholder="provider/model"
            />
          </div>
          <Button type="submit" variant="outline" disabled={!configured || testPending}>
            {testPending ? "Testing…" : "Test model"}
          </Button>
        </form>
        {testState.error ? <p className="mt-3 text-sm text-error">{testState.error}</p> : null}
        {testState.success ? <p className="mt-3 text-sm text-primary-container">{testState.success}</p> : null}
      </div>

      <form action={saveAction} className="space-y-8">
        {groups.map((group) => {
          const tasks = TASK_DEFINITIONS.filter((task) => task.group === group);
          return (
            <section key={group} aria-labelledby={`models-${group.toLowerCase()}`}>
              <h2 id={`models-${group.toLowerCase()}`} className="font-headline text-xl font-semibold text-on-background">
                {group}
              </h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {tasks.map((task) => (
                  <div key={task.taskType} className="rounded-lg border border-outline-variant/20 bg-surface-primary p-4 paper-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label htmlFor={task.taskType} className="text-base font-semibold text-on-background">
                          {task.label}
                        </Label>
                        <p className="mt-1 text-xs leading-relaxed text-secondary">{task.description}</p>
                      </div>
                      <Badge variant="default">{TASK_MODEL_TIER[task.taskType]}</Badge>
                    </div>
                    <Input
                      id={task.taskType}
                      name={task.taskType}
                      list="openrouter-model-catalog"
                      defaultValue={assignments[task.taskType]}
                      className="mt-4"
                      placeholder="provider/model"
                      required
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <datalist id="openrouter-model-catalog">
          {models.map((model) => (
            <option
              key={model.id}
              value={model.id}
              label={`${model.name} · ${priceLabel(model)}${model.contextLength ? ` · ${Math.round(model.contextLength / 1000)}k context` : ""}`}
            />
          ))}
        </datalist>

        {saveState.error ? <p className="text-sm text-error">{saveState.error}</p> : null}
        {saveState.success ? <p className="text-sm text-primary-container">{saveState.success}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={savePending}>
            {savePending ? "Saving…" : "Save model assignments"}
          </Button>
          <p className="text-xs text-secondary">
            The live catalog contains {models.length} text models. You can also type any valid OpenRouter model ID.
          </p>
        </div>
      </form>
    </div>
  );
}

