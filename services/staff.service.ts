import { z } from "zod";
import { getDb, type WorkerEnv } from "@/db/client";
import { sqlFirst, sqlRun } from "@/db/raw";
import { AppError } from "@/lib/errors";
import { publishRealtimeEvent } from "@/services/realtime-publisher.service";

const presenceSchema = z.object({
  state: z.enum(["online", "offline", "break"]),
  notes: z.string().optional()
});

type PresenceStatus = "clocked_in" | "clocked_out" | "break";

function mapState(state: "online" | "offline" | "break"): PresenceStatus {
  if (state === "online") return "clocked_in";
  if (state === "offline") return "clocked_out";
  return "break";
}

export async function updateStaffPresence(env: WorkerEnv, userId: string, rawBody: unknown) {
  const body = presenceSchema.parse(rawBody);
  const db = getDb(env);

  const user = await sqlFirst<{ id: string }>(
    db,
    "SELECT id FROM users WHERE id = ? AND role IN ('designer', 'owner') AND is_active = 1 LIMIT 1",
    [userId]
  );

  if (!user) {
    throw new AppError("User not found or inactive", 404, "USER_NOT_FOUND");
  }

  const status = mapState(body.state);
  const now = new Date().toISOString();

  if (status === "clocked_out") {
    await sqlRun(
      db,
      `UPDATE staff_presence
       SET ended_at = ?
       WHERE user_id = ? AND ended_at IS NULL`,
      [now, userId]
    );

    await sqlRun(
      db,
      `INSERT INTO staff_presence (user_id, status, started_at, ended_at, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, status, now, now, body.notes ?? null]
    );
  } else {
    await sqlRun(
      db,
      `INSERT INTO staff_presence (user_id, status, started_at, notes)
       VALUES (?, ?, ?, ?)`,
      [userId, status, now, body.notes ?? null]
    );
  }

  await sqlRun(db, "UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [userId]);

  await publishRealtimeEvent(env, {
    type: "staff.presence.updated",
    userId,
    payload: {
      userId,
      state: body.state,
      lastSeen: now
    }
  });

  return {
    userId,
    state: body.state,
    lastSeen: now
  };
}
