import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOrCreateDefaultBoard(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<string> {
  const { data: existing } = await params.supabase
    .from("canvas_boards")
    .select("id")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await params.supabase
    .from("canvas_boards")
    .insert({
      user_id: params.userId,
      title: "Research board",
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Could not create canvas board");
  }
  return created.id;
}

export async function ensureCanvasAnalysisNodes(params: {
  supabase: SupabaseClient;
  userId: string;
  boardId: string;
  sourceNodeId: string;
  researchItemId: string;
  baseX: number;
  baseY: number;
}): Promise<void> {
  const { data: item } = await params.supabase
    .from("research_items")
    .select("id, analysis")
    .eq("id", params.researchItemId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!item) return;

  const analysis = (item.analysis ?? {}) as Record<string, unknown>;
  const hasAnalysis =
    Boolean(analysis.hookType) ||
    Boolean(analysis.reusablePattern) ||
    (Array.isArray(analysis.whyItMayWork) && analysis.whyItMayWork.length > 0);
  if (!hasAnalysis) return;

  const { data: existing } = await params.supabase
    .from("canvas_nodes")
    .select("id, node_type")
    .eq("board_id", params.boardId)
    .eq("research_item_id", params.researchItemId)
    .in("node_type", ["analysis", "pattern"]);

  if ((existing ?? []).some((n) => n.node_type === "analysis")) {
    return;
  }

  const patternText =
    typeof analysis.reusablePattern === "string"
      ? analysis.reusablePattern
      : Array.isArray(analysis.reusablePattern)
        ? (analysis.reusablePattern as string[]).join("; ")
        : null;

  const structure =
    Array.isArray(analysis.structureBeats) && analysis.structureBeats.length > 0
      ? ` Structure: ${(analysis.structureBeats as string[]).slice(0, 2).join(" · ")}`
      : "";

  const { data: analysisNode } = await params.supabase
    .from("canvas_nodes")
    .insert({
      board_id: params.boardId,
      user_id: params.userId,
      node_type: "analysis",
      title: "Analysis",
      body:
        ((Array.isArray(analysis.whyItMayWork)
          ? (analysis.whyItMayWork as string[]).slice(0, 3).join(" · ")
          : null) ||
          "Observed + interpreted analysis") + structure,
      payload: analysis,
      position_x: params.baseX + 40,
      position_y: params.baseY + 140,
      research_item_id: item.id,
    })
    .select("id")
    .single();

  if (analysisNode?.id) {
    await params.supabase.from("canvas_edges").insert({
      board_id: params.boardId,
      user_id: params.userId,
      from_node_id: params.sourceNodeId,
      to_node_id: analysisNode.id,
      label: "analyzes",
    });
  }

  if (patternText && analysisNode?.id) {
    const { data: patternNode } = await params.supabase
      .from("canvas_nodes")
      .insert({
        board_id: params.boardId,
        user_id: params.userId,
        node_type: "pattern",
        title: "Pattern",
        body: patternText.slice(0, 400),
        payload: { pattern: patternText },
        position_x: params.baseX + 80,
        position_y: params.baseY + 280,
        research_item_id: item.id,
      })
      .select("id")
      .single();
    if (patternNode?.id) {
      await params.supabase.from("canvas_edges").insert({
        board_id: params.boardId,
        user_id: params.userId,
        from_node_id: analysisNode.id,
        to_node_id: patternNode.id,
        label: "extracts",
      });
    }
  }

  await params.supabase
    .from("canvas_boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.boardId);
}

export async function addResearchItemToCanvas(params: {
  supabase: SupabaseClient;
  userId: string;
  researchItemId: string;
}): Promise<{ boardId: string; sourceNodeId: string }> {
  const boardId = await getOrCreateDefaultBoard(params);

  const { data: item } = await params.supabase
    .from("research_items")
    .select(
      "id, title, hook_text, topic, platform, creator_name, outlier_score, analysis, external_url",
    )
    .eq("id", params.researchItemId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!item) throw new Error("Research item not found");

  const { count } = await params.supabase
    .from("canvas_nodes")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId);

  const index = count ?? 0;
  const x = 40 + (index % 4) * 280;
  const y = 40 + Math.floor(index / 4) * 180;

  const { data: sourceNode, error: sourceError } = await params.supabase
    .from("canvas_nodes")
    .insert({
      board_id: boardId,
      user_id: params.userId,
      node_type: "source",
      title: item.title || item.hook_text || "Outlier source",
      body: `${item.platform} · ${item.creator_name ?? "creator"} · ${
        item.outlier_score != null
          ? `${Number(item.outlier_score).toFixed(1)}×`
          : "unscored"
      }`,
      payload: {
        externalUrl: item.external_url,
        topic: item.topic,
      },
      position_x: x,
      position_y: y,
      research_item_id: item.id,
    })
    .select("id")
    .single();
  if (sourceError || !sourceNode) {
    throw new Error(sourceError?.message ?? "Could not create source node");
  }

  await ensureCanvasAnalysisNodes({
    supabase: params.supabase,
    userId: params.userId,
    boardId,
    sourceNodeId: sourceNode.id,
    researchItemId: item.id,
    baseX: x,
    baseY: y,
  });

  await params.supabase
    .from("canvas_boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", boardId);

  return { boardId, sourceNodeId: sourceNode.id };
}
