import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { getWorkerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/guard";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlFirst } from "@/db/raw";

const COMMISSION_PER_PLAYER_CENTS = 4000; // ₱40.00

export async function GET(request: NextRequest) {
  try {
    const env = getWorkerEnv();
    const session = await requireAuth(request, env.AUTH_SECRET, ["designer"]);
    const db = getDb(env as WorkerEnv);

    const row = await sqlFirst<{ total_players: number }>(
      db,
      `SELECT COALESCE(SUM(oi.quantity), 0) as total_players
       FROM designer_assignments da
       INNER JOIN orders o ON o.id = da.order_id AND o.status = 'delivered'
       INNER JOIN order_items oi ON oi.order_id = o.id
       WHERE da.designer_user_id = ?`,
      [session.sub]
    );

    const totalPlayers = row?.total_players ?? 0;

    return ok({
      total_players: totalPlayers,
      total_commission_cents: totalPlayers * COMMISSION_PER_PLAYER_CENTS,
    });
  } catch (error) {
    return fail(error);
  }
}
