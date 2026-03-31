import { NextResponse } from "next/server";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlAll } from "@/db/raw";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const COMMISSION_PER_PLAYER_CENTS = 4000; // ₱40.00

export async function GET() {
  try {
    const ctx = getCloudflareContext();
    const resolved = ctx instanceof Promise ? await ctx : ctx;
    const env = resolved.env as WorkerEnv;
    const db = getDb(env);

    const rows = await sqlAll<{
      id: string;
      full_name: string;
      total_players: number;
    }>(
      db,
      `SELECT
         u.id,
         u.full_name,
         COALESCE(SUM(oi.quantity), 0) as total_players
       FROM users u
       LEFT JOIN designer_assignments da ON da.designer_user_id = u.id
       LEFT JOIN orders o ON o.id = da.order_id AND o.status = 'delivered'
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE u.role = 'designer' AND u.is_active = 1
       GROUP BY u.id, u.full_name
       ORDER BY total_players DESC`,
      []
    );

    const data = rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      total_players: r.total_players,
      total_commission_cents: r.total_players * COMMISSION_PER_PLAYER_CENTS,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    );
  }
}
