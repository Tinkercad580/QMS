// backend/database-manager/database.service.ts
// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC DATABASE SERVICE v4.0 - PostgreSQL edition
// Same public API as the old better-sqlite3 version, now backed by a single
// shared Postgres connection pool. Every method is async (Postgres is a
// network round-trip, unlike the old synchronous SQLite file access), and
// every WHERE/VALUES clause is still authored with '?' placeholders — this
// class converts them to Postgres's '$1, $2, ...' style internally, so call
// sites elsewhere in the app didn't need their SQL strings rewritten.
// ═══════════════════════════════════════════════════════════════════════════

import { Pool, PoolClient, types } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

// node-postgres returns BIGINT/NUMERIC as strings by default (avoids silent
// precision loss on huge values) — but every COUNT(*)/SUM(...) in this app's
// SQL gets used in plain JS arithmetic (e.g. `a + b`), where a string result
// would silently concatenate instead of add ("1" + "0" === "10", not 1).
// This app's numbers are well within JS's safe integer range, so parsing them
// as regular numbers here is safe and matches how better-sqlite3 behaved.
types.setTypeParser(20, (val: string) => parseInt(val, 10));   // int8/bigint (COUNT)
types.setTypeParser(1700, (val: string) => parseFloat(val));   // numeric (SUM)

const SLOW_QUERY_THRESHOLD_MS = 100;

// Tracks the active transaction client (if any) for the current async call
// chain, so nested insert/update/delete/select calls made inside a
// transaction() callback automatically run on that same client instead of
// grabbing a fresh connection from the pool.
const txStorage = new AsyncLocalStorage<PoolClient>();

// Converts '?' placeholders to Postgres '$1, $2, ...', skipping any '?' that
// appears inside a single-quoted string literal (so a literal question mark
// in application data/SQL text is never mistaken for a placeholder).
function toPgPlaceholders(sql: string): string {
  let out = '';
  let inString = false;
  let paramIndex = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      inString = !inString;
      out += ch;
    } else if (ch === '?' && !inString) {
      paramIndex++;
      out += `$${paramIndex}`;
    } else {
      out += ch;
    }
  }
  return out;
}

class DynamicDatabaseService {
  private static instances: Map<string, DynamicDatabaseService> = new Map();
  private static pool: Pool;
  private dbName: string;
  // Resolves once this instance's schema + migrations have finished running —
  // every public method awaits this first, so callers never need to await
  // getDatabase() itself (it stays synchronous, matching how every route file
  // already calls it once at module load time).
  private ready: Promise<void>;

  private constructor(dbName: string, schema?: string) {
    this.dbName = dbName;
    this.ready = this.init(schema);
  }

  private static getPool(): Pool {
    if (!DynamicDatabaseService.pool) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is not set — add it to your .env file (see .env.example)');
      }
      DynamicDatabaseService.pool = new Pool({ connectionString });
      DynamicDatabaseService.pool.on('error', err => {
        console.error('❌ Postgres pool error (idle client):', err.message);
      });
      console.log('✅ Postgres connection pool created');
    }
    return DynamicDatabaseService.pool;
  }

  // Ensures 'CREATE EXTENSION' runs exactly once per process, even though
  // multiple DynamicDatabaseService instances initialize concurrently at
  // import time — without this, two concurrent "IF NOT EXISTS" statements can
  // still race and violate Postgres's internal pg_extension unique index.
  private static citextReady: Promise<void> | null = null;
  private static ensureCitext(pool: Pool): Promise<void> {
    if (!DynamicDatabaseService.citextReady) {
      DynamicDatabaseService.citextReady = pool.query('CREATE EXTENSION IF NOT EXISTS citext').then(() => {});
    }
    return DynamicDatabaseService.citextReady;
  }

  private async init(schema?: string): Promise<void> {
    const pool = DynamicDatabaseService.getPool();
    try {
      await DynamicDatabaseService.ensureCitext(pool);
      if (schema) {
        await pool.query(schema);
        console.log(`✅ ${this.dbName}: schema initialized`);
      }
      await this.runMigrations(pool);
      console.log(`✅ ${this.dbName} ready`);
    } catch (error: any) {
      console.error(`❌ ${this.dbName}: initialization failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get or create a database "namespace" — all namespaces share the single
   * underlying Postgres database/pool; this just tracks which schema/
   * migrations have already run for that group of tables.
   * @param dbName - Logical namespace (was a separate SQLite file before)
   * @param schema - Optional SQL schema (only run once, on first creation)
   */
  public static getDatabase(dbName: string, schema?: string): DynamicDatabaseService {
    if (!DynamicDatabaseService.instances.has(dbName)) {
      DynamicDatabaseService.instances.set(dbName, new DynamicDatabaseService(dbName, schema));
    }
    return DynamicDatabaseService.instances.get(dbName)!;
  }

  /**
   * Close the shared pool (call once, on process shutdown).
   */
  public static async closeAll(): Promise<void> {
    console.log('🛑 Closing database pool...');
    DynamicDatabaseService.instances.clear();
    if (DynamicDatabaseService.pool) {
      await DynamicDatabaseService.pool.end();
    }
    console.log('✅ Database pool closed');
  }

  // Column-existence-driven migrations, same idea as before but against
  // Postgres's information_schema instead of SQLite's PRAGMA table_info.
  private async runMigrations(pool: Pool): Promise<void> {
    try {
      const columnExists = async (table: string, column: string): Promise<boolean> => {
        const res = await pool.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
          [table, column]
        );
        return (res.rowCount ?? 0) > 0;
      };
      const tableExists = async (table: string): Promise<boolean> => {
        const res = await pool.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
          [table]
        );
        return (res.rowCount ?? 0) > 0;
      };

      if (await tableExists('patient_visits')) {
        if (!(await columnExists('patient_visits', 'queue_entry_id'))) {
          await pool.query(`ALTER TABLE patient_visits ADD COLUMN queue_entry_id INTEGER`);
          console.log(`✅ ${this.dbName}: Migration applied — queue_entry_id added to patient_visits`);
        }
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_visits_queue_entry ON patient_visits(queue_entry_id)`);
      }

      if (await tableExists('opd_records')) {
        for (const col of ['medicines', 'advice', 'investigations', 'vitals']) {
          if (!(await columnExists('opd_records', col))) {
            await pool.query(`ALTER TABLE opd_records ADD COLUMN ${col} TEXT`);
            console.log(`✅ ${this.dbName}: Migration applied — ${col} added to opd_records`);
          }
        }
      }

      if (await tableExists('queue_entries')) {
        for (const col of ['hold_reason', 'hold_at']) {
          if (!(await columnExists('queue_entries', col))) {
            await pool.query(`ALTER TABLE queue_entries ADD COLUMN ${col} TEXT`);
            console.log(`✅ ${this.dbName}: Migration applied — ${col} added to queue_entries`);
          }
        }
      }

      if (await tableExists('patients')) {
        for (const col of ['affected_area', 'injury_history', 'previous_surgeries', 'mobility_status']) {
          if (!(await columnExists('patients', col))) {
            await pool.query(`ALTER TABLE patients ADD COLUMN ${col} TEXT`);
            console.log(`✅ ${this.dbName}: Migration applied — ${col} added to patients`);
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ ${this.dbName}: Migration failed:`, error.message);
    }
  }

  private logSlowQuery(queryName: string, duration: number): void {
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`🐌 ${this.dbName}.${queryName} (${duration}ms)`);
    }
  }

  // Runs on the active transaction client if one is set for this async
  // context (see transaction()), otherwise on the shared pool.
  private getExecutor(): Pool | PoolClient {
    return txStorage.getStore() ?? DynamicDatabaseService.getPool();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS - DYNAMIC QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Insert record dynamically
   * @returns The new row's id
   */
  public async insert(tableName: string, data: Record<string, any>): Promise<number> {
    await this.ready;
    const startTime = Date.now();
    try {
      const columns = Object.keys(data);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = Object.values(data);

      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`;
      const result = await this.getExecutor().query(sql, values);

      this.logSlowQuery(`insert(${tableName})`, Date.now() - startTime);
      return result.rows[0].id;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.insert(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Update record dynamically
   * @param where - WHERE condition (e.g., 'id = ?')
   * @returns Number of rows updated
   */
  public async update(tableName: string, data: Record<string, any>, where: string, whereParams: any[]): Promise<number> {
    await this.ready;
    const startTime = Date.now();
    try {
      const dataKeys = Object.keys(data);
      const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
      const shiftedWhere = toPgPlaceholders(where).replace(/\$(\d+)/g, (_, n) => `$${Number(n) + dataKeys.length}`);
      const values = [...Object.values(data), ...whereParams];

      const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${shiftedWhere}`;
      const result = await this.getExecutor().query(sql, values);

      this.logSlowQuery(`update(${tableName})`, Date.now() - startTime);
      return result.rowCount ?? 0;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.update(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Select records dynamically
   */
  public async select(tableName: string, where?: string, whereParams?: any[], limit?: number): Promise<any[]> {
    await this.ready;
    const startTime = Date.now();
    try {
      let sql = `SELECT * FROM ${tableName}`;
      if (where) sql += ` WHERE ${toPgPlaceholders(where)}`;
      if (limit) sql += ` LIMIT ${limit}`;

      const result = await this.getExecutor().query(sql, whereParams || []);
      this.logSlowQuery(`select(${tableName})`, Date.now() - startTime);
      return result.rows;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.select(${tableName}) failed:`, error.message);
      return [];
    }
  }

  /**
   * Select one record dynamically
   */
  public async selectOne(tableName: string, where: string, whereParams: any[]): Promise<any | null> {
    await this.ready;
    const startTime = Date.now();
    try {
      const sql = `SELECT * FROM ${tableName} WHERE ${toPgPlaceholders(where)} LIMIT 1`;
      const result = await this.getExecutor().query(sql, whereParams);

      this.logSlowQuery(`selectOne(${tableName})`, Date.now() - startTime);
      return result.rows[0] || null;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.selectOne(${tableName}) failed:`, error.message);
      return null;
    }
  }

  /**
   * Delete records dynamically
   * @returns Number of deleted rows
   */
  public async delete(tableName: string, where: string, whereParams: any[]): Promise<number> {
    await this.ready;
    const startTime = Date.now();
    try {
      const sql = `DELETE FROM ${tableName} WHERE ${toPgPlaceholders(where)}`;
      const result = await this.getExecutor().query(sql, whereParams);

      this.logSlowQuery(`delete(${tableName})`, Date.now() - startTime);
      return result.rowCount ?? 0;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.delete(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute a raw SELECT-style query, written with '?' placeholders.
   */
  public async query(sql: string, params?: any[]): Promise<any[]> {
    await this.ready;
    const startTime = Date.now();
    try {
      const result = await this.getExecutor().query(toPgPlaceholders(sql), params || []);
      this.logSlowQuery('query(custom)', Date.now() - startTime);
      return result.rows;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.query() failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute raw SQL (for INSERT/UPDATE/DELETE), written with '?' placeholders.
   * @returns { rowCount, rows } — the Postgres result shape.
   */
  public async exec(sql: string, params?: any[]): Promise<{ rowCount: number | null; rows: any[] }> {
    await this.ready;
    const startTime = Date.now();
    try {
      const result = await this.getExecutor().query(toPgPlaceholders(sql), params || []);
      this.logSlowQuery('exec(custom)', Date.now() - startTime);
      return { rowCount: result.rowCount, rows: result.rows };
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.exec() failed:`, error.message);
      throw error;
    }
  }

  /**
   * Create table dynamically (runs arbitrary DDL).
   */
  public async createTable(tableName: string, schema: string): Promise<void> {
    await this.ready;
    try {
      await this.getExecutor().query(schema);
      console.log(`✅ ${this.dbName}: Table '${tableName}' created`);
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.createTable(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a record exists
   */
  public async exists(tableName: string, where: string, whereParams: any[]): Promise<boolean> {
    await this.ready;
    try {
      const sql = `SELECT 1 FROM ${tableName} WHERE ${toPgPlaceholders(where)} LIMIT 1`;
      const result = await this.getExecutor().query(sql, whereParams);
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.exists(${tableName}) failed:`, error.message);
      return false;
    }
  }

  /**
   * Count records
   */
  public async count(tableName: string, where?: string, whereParams?: any[]): Promise<number> {
    await this.ready;
    try {
      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      if (where) sql += ` WHERE ${toPgPlaceholders(where)}`;

      const result = await this.getExecutor().query(sql, whereParams || []);
      return parseInt(result.rows[0].count, 10);
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.count(${tableName}) failed:`, error.message);
      return 0;
    }
  }

  /**
   * Atomic transaction — every insert/update/delete/select/query/exec call
   * made (on any DynamicDatabaseService instance) inside the callback runs
   * on the same client, wrapped in BEGIN/COMMIT, and rolls back on error.
   */
  public async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.ready;
    const client = await DynamicDatabaseService.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await txStorage.run(client, callback);
      await client.query('COMMIT');
      return result;
    } catch (error: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`❌ ${this.dbName}.transaction() failed:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the shared pool. Safe to call on any instance.
   */
  public async close(): Promise<void> {
    await DynamicDatabaseService.closeAll();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully (SIGINT)...');
  await DynamicDatabaseService.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully (SIGTERM)...');
  await DynamicDatabaseService.closeAll();
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default DynamicDatabaseService;
