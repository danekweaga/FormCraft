"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportAccessPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function createToken() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/reports/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Read-only report agent" }) });
    const payload = await response.json() as { token?: string; error?: string };
    setLoading(false);
    if (!response.ok || !payload.token) return setError(payload.error ?? "Could not create token.");
    setToken(payload.token);
  }
  return <Card><CardHeader><CardTitle>Read-only agent access</CardTitle><CardDescription>Create a scoped reports:read token for the FormCraft report tools endpoint. Tokens cannot create, edit, or delete data.</CardDescription></CardHeader><CardContent className="space-y-3">{token ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><p className="mb-2 text-sm font-medium">Copy this token now. FormCraft only stored its hash.</p><code className="break-all text-xs">{token}</code><Button className="mt-3" size="sm" type="button" onClick={() => navigator.clipboard.writeText(token)}>Copy token</Button></div> : <Button type="button" onClick={createToken} disabled={loading}>{loading ? "Creating…" : "Create read-only token"}</Button>}{error ? <p className="text-sm text-error">{error}</p> : null}<p className="text-xs text-secondary">Endpoint: POST /api/mcp/reports with Authorization: Bearer &lt;token&gt;</p></CardContent></Card>;
}
