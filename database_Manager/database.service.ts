// backend/database-manager/database.service.ts
// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC DATABASE SERVICE v3.0 - All-in-One Production Solution
// Use anywhere with any schema dynamically
// ═══════════════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
// import * as path from 'path';
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
  // NEW: store under backend/database_Manager/databases
  databasesDir: path.resolve(__dirname, 'databases'),
  backupPath: path.resolve(__dirname, 'backups'),
  backupTime: { hour: 3, minute: 0 },

  pragmas: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    foreign_keys: 'ON',
    cache_size: -16000, // 16MB
    temp_store: 'FILE',
    mmap_size: 10000000000,
  },

  maxDbSizeMB: 2000,
  minDeleteDays: 30,
  slowQueryThresholdMs: 100,
};

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC DATABASE SERVICE
// ═══════════════════════════════════════════════════════════════════════════
class DynamicDatabaseService {
  private static instances: Map<string, DynamicDatabaseService> = new Map();
  private db: Database.Database;
  private dbPath: string;
  private dbName: string;
  private backupTimer: NodeJS.Timeout | null = null;

  private constructor(dbName: string, schema?: string) {
    this.dbName = dbName;

    // console.log(`\n🔧 Initializing ${dbName} database...\n`);

    // Create databases directory
    if (!fs.existsSync(DEFAULT_CONFIG.databasesDir)) {
      fs.mkdirSync(DEFAULT_CONFIG.databasesDir, { recursive: true });
    }

    // Database path
    this.dbPath = path.join(DEFAULT_CONFIG.databasesDir, `${dbName}.db`);

    // Connect
    // this.db = new Database(this.dbPath, {
    //   verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    // });
    // ✅ FIX — remove verbose entirely
    this.db = new Database(this.dbPath);

    console.log(`✅ Connected: ${this.dbPath}`);

    // Encryption (optional)
    if (process.env.DB_ENCRYPTION_KEY) {
      this.db.pragma(`key = '${process.env.DB_ENCRYPTION_KEY}'`);
      console.log('🔒 Encryption enabled');
    }

    this.configurePragmas();

    // Initialize schema if provided
    if (schema) {
      this.initializeSchema(schema);
      this.runMigrations();
    }

    this.setupSmartBackup();
    this.checkDatabaseSize();

    console.log(`✅ ${dbName} ready (FAST mode)\n`);
  }

  /**
   * Get or create datinitializeSchemaabase instance
   * @param dbName - Database name (without .db extension)
   * @param schema - Optional SQL schema (only used on first creation)
   * @returns Database instance
   */
  public static getDatabase(dbName: string, schema?: string): DynamicDatabaseService {
    if (!DynamicDatabaseService.instances.has(dbName)) {
      DynamicDatabaseService.instances.set(dbName, new DynamicDatabaseService(dbName, schema));
    }
    return DynamicDatabaseService.instances.get(dbName)!;
  }

  /**
   * Close all open databases
   */
  public static closeAll(): void {
    console.log('🛑 Closing all databases...');
    DynamicDatabaseService.instances.forEach((db, name) => {
      console.log(`  - Closing ${name}...`);
      db.close();
    });
    DynamicDatabaseService.instances.clear();
    console.log('✅ All databases closed');
  }

  private configurePragmas(): void {
    Object.entries(DEFAULT_CONFIG.pragmas).forEach(([key, value]) => {
      this.db.pragma(`${key} = ${value}`);
    });
    console.log('✅ Pragmas configured');
  }

  private initializeSchema(schema: string): void {
    try {
      this.db.exec(schema);
      console.log('✅ Schema initialized');
    } catch (error) {
      console.error('❌ Schema initialization failed:', error);
      throw error;
    }
  }

  private runMigrations(): void {
    try {
      const tableExists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='patient_visits'`
      ).get();
      if (!tableExists) return;

      const cols = this.db.prepare(`PRAGMA table_info(patient_visits)`).all() as any[];
      if (!cols.some(c => c.name === 'queue_entry_id')) {
        this.db.exec(`ALTER TABLE patient_visits ADD COLUMN queue_entry_id INTEGER`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_visits_queue_entry ON patient_visits(queue_entry_id)`);
        console.log(`✅ ${this.dbName}: Migration applied — queue_entry_id added to patient_visits`);
      }
    } catch (error: any) {
      console.error(`❌ ${this.dbName}: Migration failed:`, error.message);
    }
  }


  private setupSmartBackup(): void {
    this.backupTimer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === DEFAULT_CONFIG.backupTime.hour && now.getMinutes() === DEFAULT_CONFIG.backupTime.minute) {
        this.backupSafe().catch(err => console.error('❌ Auto-backup failed:', err));
      }
    }, 60000);
  }

  private checkDatabaseSize(): void {
    try {
      const stats = fs.statSync(this.dbPath);
      const sizeMB = stats.size / 1024 / 1024;

      if (sizeMB > DEFAULT_CONFIG.maxDbSizeMB) {
        console.error(`🚨 ${this.dbName} size: ${sizeMB.toFixed(2)}MB - Archive!`);
      } else if (sizeMB > DEFAULT_CONFIG.maxDbSizeMB / 2) {
        console.warn(`⚠️ ${this.dbName} size: ${sizeMB.toFixed(2)}MB`);
      }
    } catch (error) {
      // Ignore if file doesn't exist yet
    }
  }

  private logSlowQuery(queryName: string, duration: number): void {
    if (duration > DEFAULT_CONFIG.slowQueryThresholdMs) {
      console.warn(`🐌 ${this.dbName}.${queryName} (${duration}ms)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS - DYNAMIC QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Insert record dynamically
   * @param tableName - Table name
   * @param data - Object with column:value pairs
   * @returns Insert ID
   */
  public insert(tableName: string, data: Record<string, any>): number {
    const startTime = Date.now();
    try {
      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(data);

      const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      const stmt = this.db.prepare(sql);
      const info = stmt.run(...values);

      const duration = Date.now() - startTime;
      this.logSlowQuery(`insert(${tableName})`, duration);

      // console.log(`💾 ${this.dbName}.${tableName}: Inserted row ID ${info.lastInsertRowid} (${duration}ms)`);
      return info.lastInsertRowid as number;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.insert(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Update record dynamically
   * @param tableName - Table name
   * @param data - Object with column:value pairs to update
   * @param where - WHERE condition (e.g., 'id = ?')
   * @param whereParams - Parameters for WHERE condition
   * @returns Number of rows updated
   */
  public update(tableName: string, data: Record<string, any>, where: string, whereParams: any[]): number {
    const startTime = Date.now();
    try {
      const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(data), ...whereParams];

      const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${where}`;
      const stmt = this.db.prepare(sql);
      const info = stmt.run(...values);

      const duration = Date.now() - startTime;
      this.logSlowQuery(`update(${tableName})`, duration);

      // console.log(`✏️ ${this.dbName}.${tableName}: Updated ${info.changes} rows (${duration}ms)`);
      return info.changes;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.update(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Select records dynamically
   * @param tableName - Table name
   * @param where - Optional WHERE condition
   * @param whereParams - Optional WHERE parameters
   * @param limit - Optional limit
   * @returns Array of records
   */
  public select(tableName: string, where?: string, whereParams?: any[], limit?: number): any[] {
    const startTime = Date.now();
    try {
      let sql = `SELECT * FROM ${tableName}`;
      if (where) sql += ` WHERE ${where}`;
      if (limit) sql += ` LIMIT ${limit}`;

      const stmt = this.db.prepare(sql);
      const rows = whereParams ? stmt.all(...whereParams) : stmt.all();

      const duration = Date.now() - startTime;
      this.logSlowQuery(`select(${tableName})`, duration);

      return rows as any[];
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.select(${tableName}) failed:`, error.message);
      return [];
    }
  }

  /**
   * Select one record dynamically
   * @param tableName - Table name
   * @param where - WHERE condition
   * @param whereParams - WHERE parameters
   * @returns Single record or null
   */
  public selectOne(tableName: string, where: string, whereParams: any[]): any | null {
    const startTime = Date.now();
    try {
      const sql = `SELECT * FROM ${tableName} WHERE ${where} LIMIT 1`;
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...whereParams);

      const duration = Date.now() - startTime;
      this.logSlowQuery(`selectOne(${tableName})`, duration);

      return row || null;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.selectOne(${tableName}) failed:`, error.message);
      return null;
    }
  }

  /**
   * Delete records dynamically
   * @param tableName - Table name
   * @param where - WHERE condition
   * @param whereParams - WHERE parameters
   * @returns Number of deleted rows
   */
  public delete(tableName: string, where: string, whereParams: any[]): number {
    const startTime = Date.now();
    try {
      const sql = `DELETE FROM ${tableName} WHERE ${where}`;
      const stmt = this.db.prepare(sql);
      const info = stmt.run(...whereParams);

      const duration = Date.now() - startTime;
      this.logSlowQuery(`delete(${tableName})`, duration);

      // console.log(`🗑️  ${this.dbName}.${tableName}: Deleted ${info.changes} rows (${duration}ms)`);
      return info.changes;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.delete(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute raw SQL query
   * @param sql - SQL query
   * @param params - Optional parameters
   * @returns Query result
   */
  public query(sql: string, params?: any[]): any {
    const startTime = Date.now();
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.all(...params) : stmt.all();

      const duration = Date.now() - startTime;
      this.logSlowQuery('query(custom)', duration);

      return result;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.query() failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute raw SQL (for INSERT/UPDATE/DELETE)
   * @param sql - SQL statement
   * @param params - Optional parameters
   * @returns Statement info
   */
  public exec(sql: string, params?: any[]): Database.RunResult {
    const startTime = Date.now();
    try {
      const stmt = this.db.prepare(sql);
      const info = params ? stmt.run(...params) : stmt.run();

      const duration = Date.now() - startTime;
      this.logSlowQuery('exec(custom)', duration);

      return info;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.exec() failed:`, error.message);
      throw error;
    }
  }

  /**
   * Create table dynamically
   * @param tableName - Table name
   * @param schema - SQL schema definition
   */
  public createTable(tableName: string, schema: string): void {
    try {
      this.db.exec(schema);
      console.log(`✅ ${this.dbName}: Table '${tableName}' created`);
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.createTable(${tableName}) failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if record exists
   * @param tableName - Table name
   * @param where - WHERE condition
   * @param whereParams - WHERE parameters
   * @returns True if exists
   */
  public exists(tableName: string, where: string, whereParams: any[]): boolean {
    try {
      const sql = `SELECT 1 FROM ${tableName} WHERE ${where} LIMIT 1`;
      const stmt = this.db.prepare(sql);
      return stmt.get(...whereParams) !== undefined;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.exists(${tableName}) failed:`, error.message);
      return false;
    }
  }

  /**
   * Count records
   * @param tableName - Table name
   * @param where - Optional WHERE condition
   * @param whereParams - Optional WHERE parameters
   * @returns Count
   */
  public count(tableName: string, where?: string, whereParams?: any[]): number {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      if (where) sql += ` WHERE ${where}`;

      const stmt = this.db.prepare(sql);
      const result = whereParams ? stmt.get(...whereParams) : stmt.get();

      return (result as any).count;
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.count(${tableName}) failed:`, error.message);
      return 0;
    }
  }

  /**
   * Atomic transaction
   * @param callback - Transaction function
   * @returns Result
   */
  public transaction<T>(callback: () => T): T {
    try {
      return this.db.transaction(callback)();
    } catch (error: any) {
      console.error(`❌ ${this.dbName}.transaction() failed:`, error.message);
      throw error;
    }
  }

  /**
   * Backup database (safe with verification)
   */
  public async backupSafe(): Promise<string> {
    try {
      const checkpoint = this.db.pragma('wal_checkpoint(PASSIVE)', { simple: true });
      if (checkpoint !== 0) {
        console.log(`⚠️ ${this.dbName} busy, skipping backup`);
        return '';
      }

      const backupDir = DEFAULT_CONFIG.backupPath;
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = path.join(backupDir, `${this.dbName}-${timestamp}.db`);

      this.db.backup(backupPath);

      // Verify
      const backupDb = new Database(backupPath, { readonly: true });
      const integrity = backupDb.pragma('integrity_check', { simple: true });
      backupDb.close();

      if (integrity !== 'ok') {
        fs.unlinkSync(backupPath);
        throw new Error('Backup integrity failed');
      }

      console.log(`💾 ${this.dbName} backed up: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      console.error(`❌ ${this.dbName} backup failed:`, error.message);
      throw error;
    }
  }

  /**
   * Backup database (simple)
   */
  public backup(): string {
    try {
      const backupDir = DEFAULT_CONFIG.backupPath;
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = path.join(backupDir, `${this.dbName}-${timestamp}.db`);

      this.db.backup(backupPath);

      console.log(`💾 ${this.dbName} backed up: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      console.error(`❌ ${this.dbName} backup failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get database info
   */
  public getInfo(): any {
    try {
      const stats = fs.statSync(this.dbPath);
      const tableCount = this.db.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"').get() as any;

      return {
        name: this.dbName,
        path: this.dbPath,
        file_size_mb: (stats.size / 1024 / 1024).toFixed(2),
        total_tables: tableCount.count,
        wal_enabled: this.db.pragma('journal_mode', { simple: true }) === 'wal',
        sync_mode: this.db.pragma('synchronous', { simple: true }),
        last_modified: stats.mtime,
      };
    } catch (error: any) {
      console.error(`❌ ${this.dbName} getInfo() failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check database integrity
   */
  public checkIntegrity(): string {
    try {
      const result = this.db.pragma('integrity_check', { simple: true });
      console.log(`🔍 ${this.dbName} integrity: ${result}`);
      return result as string;
    } catch (error: any) {
      console.error(`❌ ${this.dbName} integrity check failed:`, error.message);
      throw error;
    }
  }

  /**
   * Checkpoint WAL
   */
  public checkpointWAL(): void {
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      // console.log(`✅ ${this.dbName} WAL checkpoint completed`);
    } catch (error: any) {
      console.error(`❌ ${this.dbName} WAL checkpoint failed:`, error.message);
    }
  }

  /**
   * Close database
   */
  public close(): void {
    try {
      if (this.backupTimer) {
        clearInterval(this.backupTimer);
      }
      this.checkpointWAL();
      this.db.close();
      console.log(`✅ ${this.dbName} closed`);
    } catch (error: any) {
      console.error(`❌ ${this.dbName} close failed:`, error.message);
    }
  }

  /**
   * Get raw database instance (for advanced usage)
   */
  public getDb(): Database.Database {
    return this.db;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully (SIGINT)...');
  DynamicDatabaseService.closeAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully (SIGTERM)...');
  DynamicDatabaseService.closeAll();
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default DynamicDatabaseService;
