// Exercise real SQL and rollback semantics; only the Expo bridge is replaced.
export function sqliteBridge() {
 const { DatabaseSync } = jest.requireActual("node:sqlite");
 const native = new DatabaseSync(":memory:");
 const db = {
  execAsync: async (sql: string) => native.exec(sql),
  runAsync: async (sql: string, ...params: unknown[]) => native.prepare(sql).run(...params),
  getFirstAsync: async (sql: string, ...params: unknown[]) => native.prepare(sql).get(...params),
  getAllAsync: async (sql: string, ...params: unknown[]) => native.prepare(sql).all(...params),
  withExclusiveTransactionAsync: async (work: (tx: unknown) => Promise<void>) => {
   native.exec("BEGIN IMMEDIATE");
   try { await work(db); native.exec("COMMIT"); } catch (error) { native.exec("ROLLBACK"); throw error; }
  },
 };
 return { openDatabaseAsync: jest.fn(async () => db) };
}
