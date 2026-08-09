import { normalizeText } from "./normalize";

export type ExtractionResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown"
  ) {
    const text = normalizeText(buffer.toString("utf8"));
    if (!text) {
      return { ok: false, error: "File is empty after text normalization." };
    }
    return { ok: true, text };
  }

  if (mimeType === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      const text = normalizeText(result.text ?? "");
      if (!text) {
        return {
          ok: false,
          error:
            "PDF text extraction returned no usable text. The file may be scanned/image-only. Original file was preserved.",
        };
      }
      return { ok: true, text };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `PDF extraction failed: ${error.message}`
            : "PDF extraction failed.",
      };
    }
  }

  return {
    ok: false,
    error: `Unsupported MIME type for extraction: ${mimeType}`,
  };
}
