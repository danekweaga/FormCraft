import { redirect } from "next/navigation";
import { Check, Flag, LockKeyhole, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { CreateMilestoneForm, CreateRoadmapForm, FollowerGoalForm, MilestoneStatusForm } from "./roadmap-forms";
import { checkpointPlan, followerCheckpoints, followerProgress, inferFollowerTarget, readFollowerGoal } from "@/lib/growth/follower-goal";
import { connectionFollowerCount } from "@/lib/social/freshness";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { deleteMilestoneAction, deleteRoadmapAction } from "./actions";

const pathPositions = ["-translate-x-16", "translate-x-12", "translate-x-20", "translate-x-0"];

export default async function RoadmapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: roadmaps }, { data: accounts }] = await Promise.all([
    supabase.from("creator_roadmaps").select("id, goal, current_phase, progress_pct, status, created_at, updated_at, metadata").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("social_connections").select("id,platform,username,display_name,metadata,last_successful_sync_at").eq("user_id", user.id).eq("account_type", "owned").eq("use_for_roadmap", true).neq("status", "disconnected"),
  ]);
  const active = roadmaps?.find((row) => row.status === "active") ?? roadmaps?.[0] ?? null;
  const savedFollowerGoal = readFollowerGoal(active?.metadata ?? null);
  const selectedAccount = (accounts ?? []).find((account) => account.id === savedFollowerGoal?.connectionId) ?? (accounts ?? []).find((account) => account.platform === "instagram") ?? accounts?.[0] ?? null;
  const liveFollowerCount = selectedAccount ? connectionFollowerCount(selectedAccount.metadata) : null;
  const inferredTarget = savedFollowerGoal?.target ?? inferFollowerTarget(active?.goal) ?? 10_000;
  const followerGoal = {
    target: inferredTarget,
    current: liveFollowerCount ?? savedFollowerGoal?.current ?? null,
    connectionId: selectedAccount?.id ?? savedFollowerGoal?.connectionId ?? null,
    updatedAt: liveFollowerCount != null ? selectedAccount?.last_successful_sync_at ?? savedFollowerGoal?.updatedAt ?? null : savedFollowerGoal?.updatedAt ?? null,
  };
  const currentFollowers = followerGoal.current ?? 0;
  const progress = followerProgress(followerGoal.current, followerGoal.target);
  const checkpoints = followerCheckpoints(followerGoal.target);
  const nextCheckpoint = checkpoints.find((value) => value > currentFollowers);
  const reachedCount = checkpoints.filter((value) => currentFollowers >= value).length;
  const currentLevel = Math.min(reachedCount + 1, checkpoints.length);
  const followersToNext = nextCheckpoint == null ? 0 : Math.max(0, nextCheckpoint - currentFollowers);
  const { data: milestones } = active ? await supabase.from("roadmap_milestones").select("id, title, category, status, source_kind, notes, deadline, sort_order, created_at").eq("roadmap_id", active.id).order("sort_order", { ascending: true }) : { data: [] };

  return (
    <div className="pb-16">
      <PageHeader title="Roadmap" description="Level up your audience one checkpoint at a time." />
      {!active ? (
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 rounded-[2rem] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-center text-white shadow-[0_12px_0_#3730a3]">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-amber-300 text-amber-950 shadow-[0_7px_0_#d97706]"><Flag className="size-9" aria-hidden="true" /></div>
            <h2 className="text-3xl font-black">Choose your destination</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-violet-100">Set a follower goal and FormCraft will turn it into a level-by-level journey.</p>
          </div>
          <CreateRoadmapForm />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-white shadow-[0_10px_0_#4338ca]">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur">LEVEL {currentLevel}</span><span className="rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-amber-950">{progress}% COMPLETE</span></div>
                <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight md:text-4xl">{active.goal}</h2>
                <div className="mt-5 max-w-2xl">
                  <div className="mb-2 flex items-end justify-between gap-4 text-sm font-bold"><span>{currentFollowers.toLocaleString()} followers</span><span>{followerGoal.target.toLocaleString()}</span></div>
                  <div className="h-5 overflow-hidden rounded-full border-2 border-white/40 bg-black/20 p-0.5 shadow-inner" role="progressbar" aria-label="Follower goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
                </div>
              </div>
              <div className="flex items-center justify-center"><div className="flex size-28 rotate-3 flex-col items-center justify-center rounded-[2rem] border-4 border-white/50 bg-white/20 shadow-[0_8px_0_rgba(49,46,129,0.65)] backdrop-blur md:size-36"><Trophy className="size-11 text-amber-300 md:size-14" aria-hidden="true" /><span className="mt-1 text-sm font-black">{reachedCount} CLEARED</span></div></div>
            </div>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
            <section className="relative overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-primary px-4 py-8 shadow-sm sm:px-8">
              <div className="mb-8 flex items-center justify-between gap-3"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-violet-600">Follower trail</p><h2 className="mt-1 text-2xl font-black text-on-background">Your levels</h2></div><Badge variant="primary">{active.current_phase}</Badge></div>
              <ol className="relative mx-auto max-w-lg py-3" aria-label="Follower checkpoints">
                <div className="absolute bottom-16 left-1/2 top-16 w-3 -translate-x-1/2 rounded-full bg-outline-variant/40" aria-hidden="true" />
                {checkpoints.map((checkpoint, index) => {
                  const reached = currentFollowers >= checkpoint;
                  const next = checkpoint === nextCheckpoint;
                  const final = index === checkpoints.length - 1;
                  return (
                    <li key={checkpoint} aria-current={next ? "step" : undefined} className="relative flex min-h-36 items-center justify-center">
                      <div className={`relative z-10 flex flex-col items-center ${pathPositions[index % pathPositions.length]}`}>
                        {next ? <span className="absolute -top-9 whitespace-nowrap rounded-full bg-on-background px-3 py-1 text-xs font-black text-background shadow-lg">YOU ARE HERE</span> : null}
                        <div className={`flex size-20 items-center justify-center rounded-full border-4 transition-transform sm:size-24 ${reached ? "border-emerald-200 bg-emerald-400 text-emerald-950 shadow-[0_8px_0_#059669]" : next ? "scale-110 border-violet-200 bg-violet-500 text-white shadow-[0_9px_0_#6d28d9,0_0_0_8px_rgba(139,92,246,0.16)]" : "border-outline-variant bg-surface-container-high text-secondary shadow-[0_7px_0_#b8b8b1]"}`}>
                          {reached ? <Check className="size-9 stroke-[3.5]" aria-hidden="true" /> : final ? <Trophy className="size-9" aria-hidden="true" /> : next ? <Zap className="size-9 fill-current" aria-hidden="true" /> : <LockKeyhole className="size-7" aria-hidden="true" />}
                        </div>
                        <div className={`mt-3 rounded-full border px-3 py-1 text-center text-sm font-black shadow-sm ${next ? "border-violet-300 bg-violet-50 text-violet-800" : reached ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-outline-variant bg-surface-primary text-secondary"}`}>{checkpoint.toLocaleString()}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <aside className="space-y-5 xl:sticky xl:top-6">
              <section className="rounded-[1.75rem] border-2 border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-[0_7px_0_#f59e0b]">
                <div className="flex items-start gap-3"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 shadow-[0_4px_0_#d97706]"><Target className="size-6" aria-hidden="true" /></div><div><p className="text-xs font-black uppercase tracking-[0.16em]">Next quest</p><h2 className="mt-1 text-xl font-black">{nextCheckpoint ? `Unlock ${nextCheckpoint.toLocaleString()}` : "Goal complete"}</h2></div></div>
                {nextCheckpoint ? <><p className="mt-4 text-3xl font-black">{followersToNext.toLocaleString()} <span className="text-base font-bold">to go</span></p><p className="mt-3 text-sm font-medium leading-6">{checkpointPlan(nextCheckpoint)}</p><div className="mt-4 rounded-2xl bg-white/70 p-3 text-sm font-bold"><Sparkles className="mr-2 inline size-4" aria-hidden="true" />Review the result after your next three posts.</div></> : <p className="mt-4 font-bold">You cleared every checkpoint. Set a bigger destination when you’re ready.</p>}
              </section>

              <details className="group rounded-[1.5rem] border border-outline-variant/30 bg-surface-primary p-5 shadow-sm">
                <summary className="cursor-pointer list-none font-black text-on-background">Goal & account settings <span className="float-right text-secondary transition-transform group-open:rotate-180">⌄</span></summary>
                <div className="mt-5 border-t border-outline-variant/30 pt-5"><FollowerGoalForm key={`${active.id}:${followerGoal.connectionId}:${followerGoal.updatedAt}`} roadmapId={active.id} target={followerGoal.target} current={followerGoal.current} connectionId={followerGoal.connectionId} accounts={(accounts ?? []).map((account) => ({ id: account.id, label: `${account.platform} · ${account.username || account.display_name || "Connected account"}` }))} /><p className="mt-3 text-xs text-secondary">{followerGoal.updatedAt ? `Last synced ${new Date(followerGoal.updatedAt).toLocaleString("en-CA", { timeZone: "UTC" })} UTC` : "Connect an account to sync this automatically."}</p></div>
              </details>

              <section className="rounded-[1.5rem] border border-outline-variant/30 bg-surface-primary p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">Side quests</p><h2 className="mt-1 text-xl font-black">Milestones</h2></div><span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-700">{milestones?.filter((item) => item.status === "done").length ?? 0}/{milestones?.length ?? 0}</span></div>
                {(milestones?.length ?? 0) === 0 ? <EmptyState title="No side quests yet" description="Add a milestone for a series, experiment, or publishing target." /> : (
                  <ul className="space-y-3">{milestones?.map((milestone) => <li key={milestone.id} className={`rounded-2xl border p-4 ${milestone.status === "done" ? "border-emerald-200 bg-emerald-50" : "border-outline-variant/40 bg-surface-container-lowest"}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${milestone.status === "done" ? "bg-emerald-400 text-emerald-950" : "bg-violet-100 text-violet-700"}`}>{milestone.status === "done" ? <Check className="size-5" /> : <Flag className="size-4" />}</span><div className="min-w-0 flex-1"><p className="font-bold text-on-background">{milestone.title}</p>{milestone.notes ? <p className="mt-1 text-sm text-secondary">{milestone.notes}</p> : null}<MilestoneStatusForm id={milestone.id} status={milestone.status} /></div><form action={deleteMilestoneAction}><input type="hidden" name="id" value={milestone.id} /><ConfirmDeleteButton confirmMessage="Delete this milestone permanently?" /></form></div></li>)}</ul>
                )}
              </section>

              <details className="group rounded-[1.5rem] border border-dashed border-outline-variant bg-surface-container-lowest p-5"><summary className="cursor-pointer list-none font-black">＋ Add a side quest <span className="float-right text-secondary transition-transform group-open:rotate-180">⌄</span></summary><div className="mt-4"><CreateMilestoneForm roadmapId={active.id} /></div></details>
              <form action={deleteRoadmapAction} className="flex justify-end"><input type="hidden" name="id" value={active.id} /><ConfirmDeleteButton confirmMessage="Delete this roadmap and all of its milestones permanently?" /></form>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
