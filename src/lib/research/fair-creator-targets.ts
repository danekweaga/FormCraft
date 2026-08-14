/**
 * Interleave creator targets by platform while preserving the stale-first
 * order inside each platform. This prevents a large YouTube or TikTok import
 * from consuming an entire scheduled batch before Instagram is reached.
 */
export function interleaveCreatorTargets<T extends { platform: string }>(
  targets: T[],
  preferredPlatformOrder: string[] = [],
): T[] {
  const queues = new Map<string, T[]>();
  for (const target of targets) {
    const queue = queues.get(target.platform) ?? [];
    queue.push(target);
    queues.set(target.platform, queue);
  }

  const platformOrder = [
    ...preferredPlatformOrder.filter((platform, index, list) =>
      queues.has(platform) && list.indexOf(platform) === index,
    ),
    ...[...queues.keys()].filter(
      (platform) => !preferredPlatformOrder.includes(platform),
    ),
  ];
  const interleaved: T[] = [];

  while (interleaved.length < targets.length) {
    let added = false;
    for (const platform of platformOrder) {
      const next = queues.get(platform)?.shift();
      if (!next) continue;
      interleaved.push(next);
      added = true;
    }
    if (!added) break;
  }

  return interleaved;
}
