"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createCaptureNodeAction } from "@/app/(app)/canvas/actions";
import { Button } from "@/components/ui/button";

const OPEN_CAPTURE_EVENT = "formcraft:open-quick-capture";

export function openGlobalQuickCapture() {
  window.dispatchEvent(new Event(OPEN_CAPTURE_EVENT));
}

export function GlobalQuickCapture() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("note");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const audioPreviewUrlRef = useRef<string | null>(null);
  const discardRecordingRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const clearAudio = useCallback(() => {
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
      audioPreviewUrlRef.current = null;
    }
  }, []);

  const discardRecording = useCallback(() => {
    discardRecordingRef.current = true;
    stopRecording();
    clearAudio();
  }, [clearAudio, stopRecording]);

  const closeCapture = useCallback(() => {
    discardRecording();
    setOpen(false);
  }, [discardRecording]);

  const startRecording = async () => {
    setMessage(null);
    clearAudio();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = preferredMimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32_000,
      });
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (recorded.size > 0 && !discardRecordingRef.current) {
          const previewUrl = URL.createObjectURL(recorded);
          audioPreviewUrlRef.current = previewUrl;
          setAudioBlob(recorded);
          setAudioPreviewUrl(previewUrl);
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        discardRecordingRef.current = false;
        setRecording(false);
        if (recordingTimeoutRef.current) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
      };
      recorder.start(500);
      setRecording(true);
      recordingTimeoutRef.current = window.setTimeout(stopRecording, 60_000);
    } catch {
      setMessage("Microphone access was denied or unavailable.");
    }
  };

  useEffect(() => {
    const openCapture = () => setOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") closeCapture();
    };
    window.addEventListener(OPEN_CAPTURE_EVENT, openCapture);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_CAPTURE_EVENT, openCapture);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeCapture]);

  useEffect(
    () => () => {
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current);
      }
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioPreviewUrlRef.current) {
        URL.revokeObjectURL(audioPreviewUrlRef.current);
      }
    },
    [],
  );

  if (!open) return null;

  const boardId = pathname.match(/^\/canvas\/([0-9a-f-]{36})$/i)?.[1];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 p-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeCapture();
      }}
    >
      <form
        aria-label="Quick capture"
        className="w-full max-w-lg space-y-3 rounded-xl border border-outline-variant/30 bg-surface-primary p-5 paper-shadow"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          if (boardId) formData.set("boardId", boardId);
          if (audioBlob) {
            formData.set(
              "audio",
              new File([audioBlob], "voice-note", { type: audioBlob.type }),
            );
          }
          setMessage(null);
          start(async () => {
            const result = await createCaptureNodeAction(formData);
            if (result.error) {
              setMessage(result.error);
              return;
            }
            setOpen(false);
            form.reset();
            setKind("note");
            clearAudio();
            if (result.boardId === boardId) router.refresh();
            else router.push(`/canvas/${result.boardId}`);
          });
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-semibold">Quick capture</h2>
            <p className="text-xs text-secondary">
              Save now; organize and connect it on Canvas later.
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={closeCapture}>
            Close
          </Button>
        </div>

        <select
          name="kind"
          className="h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm"
          value={kind}
          onChange={(event) => {
            const nextKind = event.target.value;
            setKind(nextKind);
            if (nextKind !== "voice_note") {
              discardRecording();
            }
          }}
        >
          <option value="note">Note</option>
          <option value="idea">Idea</option>
          <option value="url">URL</option>
          <option value="voice_note">Voice note</option>
          <option value="research">Research item</option>
        </select>
        {kind === "voice_note" ? (
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={recording ? "default" : "outline"}
                onClick={recording ? stopRecording : startRecording}
                disabled={pending}
              >
                {recording ? "Stop recording" : "Record voice note"}
              </Button>
              <span className="text-xs text-secondary">
                {recording
                  ? "Recording… stops automatically after 60 seconds"
                  : audioBlob
                    ? `Recorded ${Math.max(1, Math.round(audioBlob.size / 1024))} KB`
                    : "Microphone permission is required"}
              </span>
            </div>
            {audioPreviewUrl ? (
              <audio
                controls
                preload="metadata"
                src={audioPreviewUrl}
                className="mt-3 h-9 w-full"
              >
                Your browser does not support audio playback.
              </audio>
            ) : null}
          </div>
        ) : null}
        <textarea
          name="text"
          required={!audioBlob}
          rows={5}
          placeholder={
            kind === "voice_note"
              ? "Optional transcript or note about this recording…"
              : "Paste a URL, research item, note, or idea…"
          }
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm"
          autoFocus
        />
        {message ? (
          <p className="text-sm text-error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-secondary">
            {boardId ? "Adds to this board" : "Adds to your default board"}
          </p>
          <Button type="submit" disabled={pending || recording}>
            {pending ? "Saving…" : "Add to Canvas"}
          </Button>
        </div>
      </form>
    </div>
  );
}
