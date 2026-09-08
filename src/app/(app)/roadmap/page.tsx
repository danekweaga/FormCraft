import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { CreateMilestoneForm, CreateRoadmapForm, FollowerGoalForm, MilestoneStatusForm } from "./roadmap-forms";
import { checkpointPlan, followerCheckpoints, followerProgress, inferFollowerTarget, readFollowerGoal } from "@/lib/growth/follower-goal";
import { connectionFollowerCount } from "@/lib/social/freshness";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import {
  deleteMilestoneAction,
  deleteRoadmapAction,
} from "./actions";

export default async function RoadmapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: roadmaps } = await supabase
    .from("creator_roadmaps")
    .select(
      "id, goal, current_phase, progress_pct, status, created_at, updated_at, metadata",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const active = roadmaps?.find((row) => row.status === "active") ?? roadmaps?.[0] ?? null;
  const savedFollowerGoal = readFollowerGoal(active?.metadata ?? null);
  const { data: accounts } = await supabase.from("social_connections").select("id,platform,username,display_name,metadata,last_successful_sync_at").eq("user_id", user.id).eq("account_type", "owned").eq("use_for_roadmap", true).neq("status", "disconnected");
  const selectedAccount = (accounts ?? []).find((account) => account.id === savedFollowerGoal?.connectionId)
    ?? (accounts ?? []).find((account) => account.platform === "instagram")
    ?? accounts?.[0]
    ?? null;
  const liveFollowerCount = selectedAccount ? connectionFollowerCount(selectedAccount.metadata) : null;
  const inferredTarget = savedFollowerGoal?.target ?? inferFollowerTarget(active?.goal) ?? 10000;
  const followerGoal = {
    target: inferredTarget,
    current: liveFollowerCount ?? savedFollowerGoal?.current ?? null,
    connectionId: selectedAccount?.id ?? savedFollowerGoal?.connectionId ?? null,
    updatedAt: liveFollowerCount != null
      ? selectedAccount?.last_successful_sync_at ?? savedFollowerGoal?.updatedAt ?? null
      : savedFollowerGoal?.updatedAt ?? null,
  };
  const checkpoints = followerCheckpoints(followerGoal?.target ?? 10000);
  const nextCheckpoint = checkpoints.find((value) => value > (followerGoal?.current ?? -1));

  const { data: milestones } = active
    ? await supabase
        .from("roadmap_milestones")
        .select(
          "id, title, category, status, source_kind, notes, deadline, sort_order, created_at",
        )
        .eq("roadmap_id", active.id)
        .order("sort_order", { ascending: true })
    : { data: [] };

  return (
    <div>
      <PageHeader
        title="Roadmap"
        description="Track your follower journey, reach checkpoints, and turn each stage into a content plan."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateRoadmapForm />

        {active ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary">{active.status}</Badge>
                  <Badge variant="default">{active.current_phase}</Badge>
                  <Badge variant="default">{`${active.progress_pct}%`}</Badge>
                </div>
                <form action={deleteRoadmapAction}>
                  <input type="hidden" name="id" value={active.id} />
                  <ConfirmDeleteButton confirmMessage="Delete this roadmap and all of its milestones permanently?" />
                </form>
              </div>
              <h2 className="mt-3 font-headline text-2xl font-semibold text-on-background">
                {active.goal}
              </h2>
              <p className="mt-2 text-sm text-secondary">
                Connect a follower goal below. Your progress updates whenever that account syncs.
              </p>
            </div>

            <section className="space-y-5 rounded-xl border border-primary/30 bg-surface-primary p-5">
              <h2 className="text-xl font-semibold">Your follower journey</h2>
              <p className="text-3xl font-semibold">{followerGoal?.current?.toLocaleString() ?? "—"} <span className="text-base text-secondary">/ {(followerGoal?.target ?? 10000).toLocaleString()} followers</span></p>
              <progress className="h-3 w-full accent-primary" aria-label="Follower goal progress" max={100} value={followerProgress(followerGoal?.current ?? null, followerGoal?.target ?? 10000)} />
              <p className="text-sm text-secondary">{followerGoal?.updatedAt ? `Count updated ${new Date(followerGoal.updatedAt).toLocaleString("en-CA", { timeZone: "UTC" })} UTC` : "Save your current count or connect an account to establish your starting point."}</p>
              <FollowerGoalForm key={`${active.id}:${followerGoal?.connectionId}:${followerGoal?.updatedAt}`} roadmapId={active.id} target={followerGoal?.target ?? 10000} current={followerGoal?.current ?? null} connectionId={followerGoal?.connectionId ?? null} accounts={(accounts ?? []).map((account) => ({ id: account.id, label: `${account.platform} · ${account.username || account.display_name || "Connected account"}` }))} />
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {checkpoints.map((checkpoint) => {
                  const reached = followerGoal?.current != null && followerGoal.current >= checkpoint;
                  const next = checkpoint === nextCheckpoint;
                  return <li key={checkpoint} aria-current={next ? "step" : undefined} className={`rounded-2xl border p-4 ${reached ? "border-emerald-500/50 bg-emerald-500/10" : next ? "border-primary bg-primary/10" : "border-outline-variant/20"}`}><span className="text-xs text-secondary">{reached ? "✓ Reached" : next ? "Next checkpoint" : "Ahead"}</span><p className="text-xl font-semibold">{checkpoint.toLocaleString()}</p></li>;
                })}
              </ol>
              {nextCheckpoint ? <div className="rounded-xl bg-surface-container-lowest p-4"><h3 className="font-semibold">Plan for {nextCheckpoint.toLocaleString()}</h3><p className="mt-2 text-sm text-secondary">{checkpointPlan(nextCheckpoint)}</p><p className="mt-2 text-xs text-secondary">Suggested experiment for this stage; follower growth is not guaranteed. Review after your next three posts.</p></div> : <p className="font-semibold text-emerald-600">Goal reached. Set your next target when you’re ready.</p>}
            </section>

            <CreateMilestoneForm roadmapId={active.id} />

            {(milestones?.length ?? 0) === 0 ? (
              <EmptyState
                title="No milestones yet"
                description="Add a first milestone — for example a content volume target, a Teach FormCraft pack, or an experiment to run."
              />
            ) : (
              <ul className="space-y-3">
                {milestones?.map((milestone) => (
                  <li
                    key={milestone.id}
                    className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default">{milestone.status}</Badge>
                        <Badge variant="primary">{milestone.source_kind}</Badge>
                        <Badge variant="default">{milestone.category}</Badge>
                      </div>
                      <form action={deleteMilestoneAction}>
                        <input type="hidden" name="id" value={milestone.id} />
                        <ConfirmDeleteButton confirmMessage="Delete this milestone permanently?" />
                      </form>
                    </div>
                    <p className="mt-2 font-medium text-on-background">
                      {milestone.title}
                    </p>
                    {milestone.notes ? (
                      <p className="mt-1 text-sm text-secondary">
                        {milestone.notes}
                      </p>
                    ) : null}
                    <MilestoneStatusForm id={milestone.id} status={milestone.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <EmptyState
            title="No roadmap yet"
            description="Create your roadmap, then set a follower target and choose your connected account."
          />
        )}
      </div>
    </div>
  );
}
