import type { ReportResult } from "./types";

export interface ReportDeliveryProvider {
  sendReady(input: { to: string; runId: string; report: ReportResult }): Promise<{ delivered: boolean; provider: string; reason?: string }>;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

class ResendReportDelivery implements ReportDeliveryProvider {
  async sendReady(input: { to: string; runId: string; report: ReportResult }) {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.REPORT_EMAIL_FROM?.trim();
    if (!key || !from) return { delivered: false, provider: "none", reason: "Email delivery is not configured." };
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": `report-${input.runId}` },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `${input.report.title} is ready`,
        html: `<h1>${escapeHtml(input.report.title)}</h1><p>${escapeHtml(input.report.summary)}</p><h2>Top insights</h2><ul>${input.report.aiInterpretation.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><h2>Recommended actions</h2><ul>${input.report.recommendedActions.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p><a href="${appUrl}/reports/${input.runId}">Open the full evidence-backed report</a></p>`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    return { delivered: true, provider: "resend" };
  }
}

export function reportDeliveryProvider(): ReportDeliveryProvider {
  return new ResendReportDelivery();
}
