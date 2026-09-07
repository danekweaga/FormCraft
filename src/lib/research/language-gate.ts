import { franc } from "franc-min";

const ENGLISH_CODES = new Set(["eng", "sco"]);
const NON_LATIN_SCRIPT = /[\u0400-\u052f\u0600-\u06ff\u0900-\u0dff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;

/**
 * Reject clear non-English metadata locally, before it reaches the library.
 * Short or ambiguous text stays eligible because language detectors are noisy
 * on captions such as “I built this”.
 */
export function isClearlyNonEnglishText(value: string): boolean {
  const text = value.replace(/https?:\/\/\S+|#\w+|@\w+/g, " ").trim();
  if (NON_LATIN_SCRIPT.test(text)) return true;
  const letters = text.match(/[a-zÀ-ÿ]/gi)?.length ?? 0;
  if (letters < 60) return false;
  const code = franc(text, { minLength: 60 });
  return code !== "und" && !ENGLISH_CODES.has(code);
}
