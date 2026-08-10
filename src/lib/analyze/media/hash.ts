import { createHash } from "node:crypto";

export function hashMediaBytes(bytes: ArrayBuffer | Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(bytes)
    ? bytes
    : Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
  return createHash("sha256").update(buf).digest("hex");
}

export function hashMediaString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
