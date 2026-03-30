type Primitive = string | number | boolean | null;

type WhereClause = Record<string, Primitive>;

type SelectOptions = {
  where?: WhereClause;
  orderBy?: string;
  limit?: number;
  offset?: number;
};

function assertIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return identifier;
}

function buildWhere(where?: WhereClause): { sql: string; values: Primitive[] } {
  if (!where || Object.keys(where).length === 0) {
    return { sql: "", values: [] };
  }

  const entries = Object.entries(where);
  const parts = entries.map(([column]) => `${assertIdentifier(column)} = ?`);
  const values = entries.map(([, value]) => value);

  return {
    sql: ` WHERE ${parts.join(" AND ")}`,
    values
  };
}

export async function selectRows<T = Record<string, unknown>>(
  db: D1Database,
  table: string,
  options: SelectOptions = {}
): Promise<T[]> {
  const safeTable = assertIdentifier(table);
  const { sql: whereSql, values } = buildWhere(options.where);

  const orderBySql = options.orderBy
    ? ` ORDER BY ${assertIdentifier(options.orderBy)}`
    : "";
  const limitSql = typeof options.limit === "number" ? " LIMIT ?" : "";
  const offsetSql = typeof options.offset === "number" ? " OFFSET ?" : "";

  const sql = `SELECT * FROM ${safeTable}${whereSql}${orderBySql}${limitSql}${offsetSql}`;
  const bindValues: Primitive[] = [...values];

  if (typeof options.limit === "number") bindValues.push(options.limit);
  if (typeof options.offset === "number") bindValues.push(options.offset);

  const stmt = db.prepare(sql).bind(...bindValues);
  const result = await stmt.all<T>();
  return result.results;
}

export async function insertRow<T extends Record<string, Primitive>>(
  db: D1Database,
  table: string,
  data: T
): Promise<D1Result> {
  const safeTable = assertIdentifier(table);
  const keys = Object.keys(data);

  if (keys.length === 0) {
    throw new Error("insertRow requires at least one field");
  }

  const safeColumns = keys.map(assertIdentifier);
  const placeholders = safeColumns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${safeTable} (${safeColumns.join(", ")}) VALUES (${placeholders})`;
  const values = safeColumns.map((key) => data[key]);

  return db.prepare(sql).bind(...values).run();
}

export async function updateRows<
  TSet extends Record<string, Primitive>,
  TWhere extends WhereClause
>(
  db: D1Database,
  table: string,
  set: TSet,
  where: TWhere
): Promise<D1Result> {
  const safeTable = assertIdentifier(table);
  const setEntries = Object.entries(set);

  if (setEntries.length === 0) {
    throw new Error("updateRows requires at least one field in set data");
  }

  if (Object.keys(where).length === 0) {
    throw new Error("updateRows requires a non-empty where clause");
  }

  const setSql = setEntries
    .map(([column]) => `${assertIdentifier(column)} = ?`)
    .join(", ");
  const setValues = setEntries.map(([, value]) => value);

  const { sql: whereSql, values: whereValues } = buildWhere(where);
  const sql = `UPDATE ${safeTable} SET ${setSql}${whereSql}`;

  return db.prepare(sql).bind(...setValues, ...whereValues).run();
}

export async function firstRow<T = Record<string, unknown>>(
  db: D1Database,
  table: string,
  where: WhereClause
): Promise<T | null> {
  const rows = await selectRows<T>(db, table, {
    where,
    limit: 1
  });

  return rows[0] ?? null;
}
