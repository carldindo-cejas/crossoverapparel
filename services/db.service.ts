import type { WorkerEnv } from "@/db/client";
import { getDb } from "@/db/client";
import { firstRow, insertRow, selectRows, updateRows } from "@/db/query";

export function createDbService(env: WorkerEnv) {
  const db = getDb(env);

  return {
    selectRows: <T = Record<string, unknown>>(
      table: string,
      options?: Parameters<typeof selectRows<T>>[2]
    ) => selectRows<T>(db, table, options),
    firstRow: <T = Record<string, unknown>>(
      table: string,
      where: Parameters<typeof firstRow<T>>[2]
    ) => firstRow<T>(db, table, where),
    insertRow: <T extends Record<string, string | number | boolean | null>>(
      table: string,
      data: T
    ) => insertRow(db, table, data),
    updateRows: <
      TSet extends Record<string, string | number | boolean | null>,
      TWhere extends Record<string, string | number | boolean | null>
    >(
      table: string,
      set: TSet,
      where: TWhere
    ) => updateRows(db, table, set, where)
  };
}
