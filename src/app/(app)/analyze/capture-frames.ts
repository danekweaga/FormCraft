"use client";

/**
 * Capture strategic frames from a local video File via HTML5 video + canvas.
 */
export async function captureVideoFrames(
  file: File,
  maxFrames = 6,
): Promise<Array<{ dataUrl: string; timestampSeconds: number }>> {
  if (!file.type.startsWith("video/")) return [];

  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video for frames"));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) return [];

    const timestamps = Array.from(
      new Set(
        [
          0.05,
          Math.min(1.5, duration * 0.08),
          duration * 0.25,
          duration * 0.5,
          duration * 0.75,
          Math.max(0, duration - 0.4),
        ]
          .filter((t) => t >= 0 && t <= duration)
          .map((t) => Number(t.toFixed(2))),
      ),
    ).slice(0, maxFrames);

    const canvas = document.createElement("canvas");
    const frames: Array<{ dataUrl: string; timestampSeconds: number }> = [];

    for (const timestampSeconds of timestamps) {
      await seek(video, timestampSeconds);
      const w = Math.min(640, video.videoWidth || 640);
      const h = Math.round(
        ((video.videoHeight || 360) / (video.videoWidth || 640)) * w,
      );
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(video, 0, 0, w, h);
      frames.push({
        dataUrl: canvas.toDataURL("image/jpeg", 0.72),
        timestampSeconds,
      });
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.onerror = () => reject(new Error("Seek failed"));
    video.currentTime = time;
  });
}
