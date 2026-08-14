import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  connectionFollowerCount,
  connectionFreshness,
  formatFollowerCount,
  formatRelativeTime,
} from "@/lib/social/freshness";
import {
  getOwnedProvider,
  isOwnedPlatform,
  PLATFORM_CARDS,
} from "@/lib/social/providers";
import { friendlyOAuthError } from "@/lib/social/oauth-errors";
import {
  isReconnectRequiredError,
  reconnectRequiredCopy,
} from "@/lib/social/reconnect";
import type { SocialConnectionRow, SyncProgressStep } from "@/lib/social/types";
import { createClient } from "@/lib/supabase/server";
import {
  DisconnectPanel,
  ReconnectAccountButton,
  RefreshAllConnectedButton,
  SyncNowButton,
  SyncSettingsForm,
} from "./connection-actions";
import { SyncProgressList } from "./sync-progress";

type SearchParams = Promise<{
  error?: string;
  connected?: string;
  connection?: string;
  job?: string;
}>;

function statusBadge(status: string) {
  switch (status) {
    case "connected":
      return <Badge variant="success">Connected</Badge>;
    case "syncing":
      return <Badge variant="warning">Syncing</Badge>;
    case "needs_attention":
      return <Badge variant="warning">Needs attention</Badge>;
    case "disconnected":
      return <Badge variant="default">Disconnected</Badge>;
    default:
      return <Badge variant="default">Not connected</Badge>;
  }
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: connections } = await supabase
    .from("social_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_type", "owned")
    .neq("status", "disconnected")
    .order("created_at", { ascending: false });

  const owned = (connections ?? []) as SocialConnectionRow[];
  const byPlatform = new Map(owned.map((c) => [c.platform, c]));

  const connectionIds = owned.map((c) => c.id);
  const { data: postCounts } = connectionIds.length
    ? await supabase
        .from("content_posts")
        .select("social_connection_id")
        .eq("user_id", user.id)
        .in("social_connection_id", connectionIds)
    : { data: [] as Array<{ social_connection_id: string | null }> };

  const countByConnection = new Map<string, number>();
  for (const row of postCounts ?? []) {
    if (!row.social_connection_id) continue;
    countByConnection.set(
      row.social_connection_id,
      (countByConnection.get(row.social_connection_id) ?? 0) + 1,
    );
  }

  const { count: syncedPosts } = await supabase
    .from("content_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "connected_account");

  const { data: failedJobs } = await supabase
    .from("social_sync_jobs")
    .select("id, social_connection_id, error_message, created_at, status")
    .eq("user_id", user.id)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(5);

  const { count: awaitingProcessing } = await supabase
    .from("content_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("needs_review", true);

  let activeJobSteps: SyncProgressStep[] = [];
  if (params.job) {
    const { data: job } = await supabase
      .from("social_sync_jobs")
      .select("progress, status, sync_type")
      .eq("id", params.job)
      .eq("user_id", user.id)
      .maybeSingle();
    if (job?.progress && Array.isArray(job.progress)) {
      activeJobSteps = job.progress as SyncProgressStep[];
    }
  } else {
    const syncing = owned.find((c) => c.status === "syncing");
    if (syncing) {
      const { data: job } = await supabase
        .from("social_sync_jobs")
        .select("progress")
        .eq("social_connection_id", syncing.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (job?.progress && Array.isArray(job.progress)) {
        activeJobSteps = job.progress as SyncProgressStep[];
      }
    }
  }

  const lastGlobalSync = owned
    .map((c) => c.last_successful_sync_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div>
      <PageHeader
        title="Connections"
        description="Where FormCraft gets your content data from — owned accounts only. Reference creators for Research stay separate."
      />

      {params.error ? (
        <div className="mb-6 rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-on-background">
          {friendlyOAuthError(params.error)}
        </div>
      ) : null}

      {params.connected ? (
        <div className="mb-6 rounded-lg border border-primary-container/30 bg-surface-container-lowest px-4 py-3 text-sm">
          Connected {params.connected}. Initial sync{" "}
          {params.job ? "progress below." : "started."}
          {activeJobSteps.length > 0 ? (
            <SyncProgressList steps={activeJobSteps} />
          ) : null}
        </div>
      ) : activeJobSteps.length > 0 ? (
        <div className="mb-6">
          <SyncProgressList steps={activeJobSteps} />
        </div>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-4 font-headline text-xl font-semibold text-on-background">
          Your accounts
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-secondary">
          Connected accounts are owned/authorized by you and feed My Content,
          Performance, Roadmap, Experiments, Audience Miner, and Today.
          External creators you study are Reference Creators — never mixed in
          here.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {PLATFORM_CARDS.map((card) => {
            const connection = byPlatform.get(card.platform);
            const configured =
              card.connectable &&
              isOwnedPlatform(card.platform) &&
              getOwnedProvider(card.platform).isConfigured();
            const unconfiguredReason =
              card.connectable && isOwnedPlatform(card.platform)
                ? getOwnedProvider(card.platform).unconfiguredReason()
                : card.comingLater
                  ? "Coming later — not configured in this phase."
                  : null;
            const capabilities =
              card.connectable && isOwnedPlatform(card.platform)
                ? getOwnedProvider(card.platform).capabilities
                : null;
            const freshness = connection
              ? connectionFreshness({
                  status: connection.status,
                  lastSuccessfulSyncAt: connection.last_successful_sync_at,
                  lastError: connection.last_error,
                  staleAfterHours: connection.sync_frequency_hours * 2,
                })
              : null;
            const needsReconnect = isReconnectRequiredError(
              connection?.last_error,
            );
            const followerCount = connection
              ? connectionFollowerCount(connection.metadata)
              : null;
            const imported = connection
              ? (countByConnection.get(connection.id) ?? 0)
              : 0;

            return (
              <Card
                key={card.platform}
                className="border-outline-variant/20 bg-surface-primary paper-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MaterialIcon name="link" className="text-primary" />
                        {card.name}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {card.description}
                      </CardDescription>
                    </div>
                    {connection
                      ? statusBadge(connection.status)
                      : card.comingLater || !configured
                        ? statusBadge("not_connected")
                        : statusBadge("not_connected")}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {connection ? (
                    <>
                      <div className="flex items-center gap-3">
                        {connection.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- provider CDN avatars
                          <img
                            src={connection.avatar_url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high">
                            <MaterialIcon name="person" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-on-background">
                            {connection.display_name ??
                              connection.username ??
                              "Connected account"}
                          </p>
                          {connection.username ? (
                            <p className="text-xs text-secondary">
                              @{connection.username.replace(/^@/, "")}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <dl className="grid gap-2 text-xs text-secondary sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-on-background">
                            Last successful sync
                          </dt>
                          <dd>
                            {formatRelativeTime(
                              connection.last_successful_sync_at,
                            ) ?? "Never"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-on-background">
                            Followers
                          </dt>
                          <dd>{formatFollowerCount(followerCount)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-on-background">
                            Next scheduled sync
                          </dt>
                          <dd>
                            {connection.next_scheduled_sync_at
                              ? new Date(
                                  connection.next_scheduled_sync_at,
                                ).toLocaleString()
                              : "Not scheduled"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-on-background">
                            Data freshness
                          </dt>
                          <dd>{freshness?.label}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-on-background">
                            Imported posts
                          </dt>
                          <dd>{imported}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="font-semibold text-on-background">
                            Permissions granted
                          </dt>
                          <dd className="mt-1 flex flex-wrap gap-1">
                            {(connection.granted_scopes ?? []).length === 0 ? (
                              <span>None recorded</span>
                            ) : (
                              connection.granted_scopes.map((scope) => (
                                <Badge key={scope} variant="default">
                                  {scope}
                                </Badge>
                              ))
                            )}
                          </dd>
                        </div>
                        {capabilities ? (
                          <div className="sm:col-span-2">
                            <dt className="font-semibold text-on-background">
                              Data available
                            </dt>
                            <dd className="mt-1 space-y-1">
                              <p>
                                Profile {capabilities.profile ? "✓" : "—"} ·
                                Posts {capabilities.posts ? "✓" : "—"} · Metrics{" "}
                                {capabilities.postMetrics ? "✓" : "—"} ·
                                Comments {capabilities.comments ? "✓" : "—"}
                              </p>
                              {!capabilities.retention ? (
                                <p>
                                  Retention data unavailable through this
                                  connection.
                                </p>
                              ) : null}
                              {!capabilities.comments ? (
                                <p>
                                  Comments not imported via this provider yet —
                                  use Audience Miner manual paste.
                                </p>
                              ) : null}
                            </dd>
                          </div>
                        ) : null}
                        {needsReconnect ? (
                          <div className="sm:col-span-2 text-error">
                            {reconnectRequiredCopy(connection.platform)}
                          </div>
                        ) : connection.last_error ? (
                          <div className="sm:col-span-2 text-error">
                            Sync error: {connection.last_error}
                          </div>
                        ) : null}
                      </dl>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {needsReconnect ? (
                            <ReconnectAccountButton
                              platform={connection.platform}
                            />
                          ) : (
                            <SyncNowButton
                              connectionId={connection.id}
                              disabled={
                                connection.status === "syncing" || !configured
                              }
                            />
                          )}
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/my-content?source=connected_account&platform=${connection.platform}`}
                            >
                              View imported content
                            </Link>
                          </Button>
                        {connection.platform === "instagram" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href="/performance">Instagram analytics</Link>
                          </Button>
                        ) : null}
                        {configured && !needsReconnect ? (
                          <ReconnectAccountButton
                            platform={card.platform}
                            label="Reconnect"
                            variant="outline"
                          />
                        ) : null}
                        <Button asChild size="sm" variant="ghost">
                          <a href={`#manage-${connection.id}`}>
                            Manage permissions
                          </a>
                        </Button>
                        </div>
                        <p className="text-xs text-secondary">
                          Pulls latest posts and account follower metrics from{" "}
                          {card.name}. Missing provider values stay Unavailable.
                        </p>
                        {!configured ? (
                          <p className="text-xs text-destructive">
                            {unconfiguredReason ??
                              "Platform env is not configured, so refresh is disabled."}
                          </p>
                        ) : null}
                      </div>

                      <div id={`manage-${connection.id}`}>
                        <SyncSettingsForm
                          connectionId={connection.id}
                          defaults={{
                            autoSyncEnabled: connection.auto_sync_enabled,
                            syncFrequencyHours: connection.sync_frequency_hours,
                            importComments: connection.import_comments,
                            importOlderPosts: connection.import_older_posts,
                            useForAi: connection.use_for_ai,
                            useForRoadmap: connection.use_for_roadmap,
                            useForExperiments: connection.use_for_experiments,
                          }}
                        />
                        <DisconnectPanel connectionId={connection.id} />
                      </div>
                    </>
                  ) : (
                    <>
                      {!configured ? (
                        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest/70 p-3 text-secondary">
                          <p className="font-medium text-on-background">
                            {card.platform === "tiktok"
                              ? "TikTok connection not configured"
                              : card.comingLater
                                ? "Coming later"
                                : "Not configured"}
                          </p>
                          <p className="mt-1 text-xs">
                            {unconfiguredReason}
                          </p>
                          <p className="mt-3 text-xs">
                            Meanwhile use{" "}
                            <Link
                              href="/my-content"
                              className="text-primary underline"
                            >
                              manual posts
                            </Link>
                            , CSV, video upload, or metric entry — nothing is
                            blocked.
                          </p>
                        </div>
                      ) : (
                        <Button asChild>
                          <a href={`/api/social/${card.platform}/authorize`}>
                            Connect {card.name}
                          </a>
                        </Button>
                      )}
                      {capabilities ? (
                        <p className="text-xs text-secondary">
                          Capabilities: profile{" "}
                          {capabilities.profile ? "yes" : "no"}, posts{" "}
                          {capabilities.posts ? "yes" : "no"}, metrics{" "}
                          {capabilities.postMetrics ? "yes" : "no"}, comments{" "}
                          {capabilities.comments ? "yes" : "no"}, retention{" "}
                          {capabilities.retention ? "yes" : "no"}.
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Data health</CardTitle>
            <CardDescription>
              Snapshot of connected platforms and sync integrity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Connected platforms:{" "}
              <strong>
                {owned.filter((c) => c.status === "connected").length}
              </strong>
            </p>
            <p>
              Total synced posts: <strong>{syncedPosts ?? 0}</strong>
            </p>
            <p>
              Last global sync:{" "}
              <strong>
                {formatRelativeTime(lastGlobalSync ?? null) ?? "Never"}
              </strong>
            </p>
            <p>
              Failed sync jobs: <strong>{failedJobs?.length ?? 0}</strong>
            </p>
            <p>
              Content awaiting processing:{" "}
              <strong>{awaitingProcessing ?? 0}</strong>
            </p>
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest/70 p-3">
              <p className="mb-2 text-xs text-secondary">
                Manually refresh posts and follower counts for every configured
                connected account.
              </p>
              <RefreshAllConnectedButton
                disabled={
                  owned.filter((c) => {
                    if (!isOwnedPlatform(c.platform)) return false;
                    return getOwnedProvider(c.platform).isConfigured();
                  }).length === 0
                }
              />
            </div>
            {(failedJobs?.length ?? 0) > 0 ? (
              <ul className="mt-2 space-y-2 text-xs text-secondary">
                {failedJobs!.map((job) => (
                  <li key={job.id}>
                    {new Date(job.created_at).toLocaleString()}:{" "}
                    {job.error_message ?? "Failed"}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-outline-variant/20 bg-surface-primary paper-shadow">
          <CardHeader>
            <CardTitle>Data controls</CardTitle>
            <CardDescription>
              What FormCraft uses your connected accounts for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-secondary">
              <li>Analyze your own content</li>
              <li>Update your performance baseline</li>
              <li>Track experiments</li>
              <li>Update roadmap progress</li>
              <li>Discover audience questions</li>
              <li>Improve future recommendations</li>
            </ul>
            <p className="mt-4 text-xs text-secondary">
              Tokens never enter the browser, AI prompts, or analytics logs.
              Manual entry remains available even when accounts are connected.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
