"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { analyzeResearchItemAction } from "@/app/(app)/research/actions";

export type CanvasActionState = {
  error?: string;
  success?: string;
};

export async function updateCanvasNodePositionAction(formData: FormData) {
  const nodeId = String(formData.get("nodeId") ?? "");
  const x = Number(formData.get("x"));
  const y = Number(formData.get("y"));
  if (!nodeId || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("canvas_nodes")
    .update({
      position_x: Math.max(0, Math.round(x)),
      position_y: Math.max(0, Math.round(y)),
    })
    .eq("id", nodeId)
    .eq("user_id", user.id);

  const { data: node } = await supabase
    .from("canvas_nodes")
    .select("board_id")
    .eq("id", nodeId)
    .maybeSingle();
  if (node?.board_id) {
    await supabase
      .from("canvas_boards")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", node.board_id);
  }
}

export async function analyzeCanvasSourceNodeAction(
  formData: FormData,
): Promise<CanvasActionState> {
  const nodeId = String(formData.get("nodeId") ?? "");
  const researchItemId = String(formData.get("researchItemId") ?? "");
  if (!nodeId || !researchItemId) {
    return { error: "Missing node or research item." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: node } = await supabase
    .from("canvas_nodes")
    .select("id, board_id, position_x, position_y, research_item_id, node_type")
    .eq("id", nodeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!node || node.node_type !== "source") {
    return { error: "Source node not found." };
  }
  if (node.research_item_id !== researchItemId) {
    return { error: "Research item mismatch." };
  }

  const analyzeFd = new FormData();
  analyzeFd.set("id", researchItemId);
  const result = await analyzeResearchItemAction(analyzeFd);
  if (result.error) return { error: result.error };

  const { ensureCanvasAnalysisNodes } = await import(
    "@/lib/canvas/add-from-research"
  );
  await ensureCanvasAnalysisNodes({
    supabase,
    userId: user.id,
    boardId: node.board_id,
    sourceNodeId: node.id,
    researchItemId,
    baseX: Number(node.position_x) || 40,
    baseY: Number(node.position_y) || 40,
  });

  revalidatePath("/canvas");
  revalidatePath("/research");
  return {
    success: result.success ?? "Analyzed — analysis/pattern nodes updated.",
  };
}
