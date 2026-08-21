"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyReportButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <Button type="button" variant="outline" onClick={copy}>{copied ? "Copied" : "Copy summary"}</Button>;
}
