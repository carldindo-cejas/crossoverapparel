export type SqlParam = string | number | boolean | null;

export async function sqlAll<T = Record<string, unknown>>(
  db: D1Database,
  query: string,
  params: SqlParam[] = []
): Promise<T[]> {
  const result = await db.prepare(query).bind(...params).all<T>();
  return result.results;
}

export async function sqlFirst<T = Record<string, unknown>>(
  db: D1Database,
  query: string,
  params: SqlParam[] = []
): Promise<T | null> {
  const row = await db.prepare(query).bind(...params).first<T>();
  return row ?? null;
}

export async function sqlRun(
  db: D1Database,
  query: string,
  params: SqlParam[] = []
): Promise<D1Result> {
  return db.prepare(query).bind(...params).run();
}

export async function sqlBatch(
  db: D1Database,
  statements: D1PreparedStatement[]
): Promise<D1Result[]> {
  return db.batch(statements);
}
