// Журнал действий администраторов и модераторов. Записи безличные — чаты анонимные.

import { supabaseAdmin } from "../config/supabase";
import type { AuditEntryDto } from "../types/dto";
import { must } from "../utils/db";

export async function addAudit(communityId: string, text: string): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_log").insert({ community_id: communityId, text: text.slice(0, 300) });
  // Журнал вспомогательный: его сбой не должен отменять само действие
  if (error) console.error("Не удалось записать в журнал:", error.message);
}

export async function listAudit(communityId: string, limit = 50): Promise<AuditEntryDto[]> {
  const rows = must(
    await supabaseAdmin
      .from("audit_log")
      .select("*")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  return rows.map((row) => ({ id: row.id, communityId: row.community_id, text: row.text, createdAt: row.created_at }));
}
