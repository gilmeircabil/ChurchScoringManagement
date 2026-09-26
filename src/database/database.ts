import * as SQLite from 'expo-sqlite';
import { IDatabaseConnection } from './types';
import { initializeDatabase } from './migrations';
import { APP_CONFIG } from '../constants/config';

let databaseInstance: IDatabaseConnection | null = null;

class ExpoSQLiteConnection implements IDatabaseConnection {
  private db: SQLite.SQLiteDatabase;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
  }

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    const res = await this.db.runAsync(sql, ...params);
    return {
      lastInsertRowId: res.lastInsertRowId,
      changes: res.changes,
    };
  }

  async getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    return await this.db.getAllAsync<T>(sql, ...params);
  }

  async getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null> {
    const res = await this.db.getFirstAsync<T>(sql, ...params);
    return res ?? null;
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    let result!: T;
    await this.db.withTransactionAsync(async () => {
      result = await task();
    });
    return result;
  }
}

/**
 * Initializes and returns the global SQLite database connection.
 */
export async function getDatabaseConnection(): Promise<IDatabaseConnection> {
  if (databaseInstance) {
    return databaseInstance;
  }

  const rawDb = await SQLite.openDatabaseAsync(APP_CONFIG.databaseName);
  const conn = new ExpoSQLiteConnection(rawDb);
  await initializeDatabase(conn);
  databaseInstance = conn;
  return databaseInstance;
}
