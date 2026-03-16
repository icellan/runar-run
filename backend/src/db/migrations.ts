import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'playgrounds.db');

export function initDb(): Database.Database {
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS playgrounds (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      language TEXT NOT NULL,
      title TEXT,
      tab TEXT,
      unlock_inputs TEXT,
      network_endpoint TEXT,
      owner_identity_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}
