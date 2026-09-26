import initSqlJs, { Database } from 'sql.js';
import { IDatabaseConnection } from '../src/database/types';
import { initializeDatabase } from '../src/database/migrations';

export class SqlJsTestConnection implements IDatabaseConnection {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  static async create(): Promise<SqlJsTestConnection> {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const conn = new SqlJsTestConnection(db);
    await initializeDatabase(conn);
    return conn;
  }

  async execAsync(sql: string): Promise<void> {
    this.db.run(sql);
  }

  async runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    // Flatten array param if single array passed
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this.db.run(sql, flatParams);
    return {
      lastInsertRowId: 1,
      changes: this.db.getRowsModified(),
    };
  }

  async getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.db.prepare(sql);
    try {
      if (flatParams && flatParams.length > 0) {
        stmt.bind(flatParams);
      }
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, ...params);
    return all.length > 0 ? all[0] : null;
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    this.db.run('SAVEPOINT sp;');
    try {
      const res = await task();
      this.db.run('RELEASE SAVEPOINT sp;');
      return res;
    } catch (err) {
      this.db.run('ROLLBACK TO SAVEPOINT sp;');
      throw err;
    }
  }
}
