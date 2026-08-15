import { redirect } from "next/navigation";

/** Audience miner is retired from the product nav — comments stay in DB if needed later. */
export default function AudiencePage() {
  redirect("/research");
}
