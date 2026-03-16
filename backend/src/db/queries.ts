import type Database from 'better-sqlite3';
import crypto from 'crypto';

export interface PlaygroundRow {
  id: string;
  source: string;
  language: string;
  title: string | null;
  tab: string | null;
  unlock_inputs: string | null;
  network_endpoint: string | null;
  owner_identity_key: string;
  created_at: string;
  updated_at: string;
}

function generateId(): string {
  return crypto.randomBytes(4).toString('hex');
}

export function createPlayground(
  db: Database.Database,
  data: {
    source: string;
    language: string;
    title?: string;
    tab?: string;
    unlockInputs?: string;
    networkEndpoint?: string;
    ownerIdentityKey: string;
  },
): PlaygroundRow {
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO playgrounds (id, source, language, title, tab, unlock_inputs, network_endpoint, owner_identity_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.source,
    data.language,
    data.title ?? null,
    data.tab ?? null,
    data.unlockInputs ?? null,
    data.networkEndpoint ?? null,
    data.ownerIdentityKey,
    now,
    now,
  );

  return getPlayground(db, id)!;
}

export function getPlayground(db: Database.Database, id: string): PlaygroundRow | undefined {
  return db.prepare('SELECT * FROM playgrounds WHERE id = ?').get(id) as PlaygroundRow | undefined;
}

export function updatePlayground(
  db: Database.Database,
  id: string,
  data: {
    source?: string;
    language?: string;
    title?: string;
    tab?: string;
    unlockInputs?: string;
    networkEndpoint?: string;
  },
): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.source !== undefined) { sets.push('source = ?'); values.push(data.source); }
  if (data.language !== undefined) { sets.push('language = ?'); values.push(data.language); }
  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.tab !== undefined) { sets.push('tab = ?'); values.push(data.tab); }
  if (data.unlockInputs !== undefined) { sets.push('unlock_inputs = ?'); values.push(data.unlockInputs); }
  if (data.networkEndpoint !== undefined) { sets.push('network_endpoint = ?'); values.push(data.networkEndpoint); }

  if (sets.length === 0) return false;

  sets.push("updated_at = datetime('now')");
  values.push(id);

  const result = db.prepare(`UPDATE playgrounds SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deletePlayground(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM playgrounds WHERE id = ?').run(id);
  return result.changes > 0;
}
