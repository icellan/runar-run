/**
 * Client for the playground sharing API.
 *
 * For unauthenticated quick shares, uses LZ-string URL encoding as a fallback
 * (no server needed). For authenticated shares with short URLs, uses the backend API.
 */

import LZString from 'lz-string';
import type { Language } from '../contexts/EditorContext';

const API_BASE = '/api';

// ---------------------------------------------------------------------------
// URL-based sharing (no auth required, no backend needed)
// ---------------------------------------------------------------------------

export interface PlaygroundState {
  source: string;
  language: Language;
}

/** Encode playground state into a URL hash */
export function encodeToHash(state: PlaygroundState): string {
  const json = JSON.stringify({ s: state.source, l: state.language });
  return LZString.compressToEncodedURIComponent(json);
}

/** Decode playground state from a URL hash */
export function decodeFromHash(hash: string): PlaygroundState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    const parsed = JSON.parse(json) as { s?: string; l?: string };
    if (!parsed.s) return null;
    return {
      source: parsed.s,
      language: (parsed.l ?? 'typescript') as Language,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API-based sharing (requires backend + wallet auth)
// ---------------------------------------------------------------------------

export interface SharedPlayground {
  id: string;
  source: string;
  language: string;
  title: string | null;
  ownerIdentityKey: string;
  createdAt: string;
}

export async function savePlayground(data: {
  source: string;
  language: string;
  title?: string;
  identityKey: string;
  signature: string;
}): Promise<{ id: string; url: string }> {
  const res = await fetch(`${API_BASE}/playgrounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to save');
  }
  return res.json() as Promise<{ id: string; url: string }>;
}

export async function loadPlayground(id: string): Promise<SharedPlayground> {
  const res = await fetch(`${API_BASE}/playgrounds/${id}`);
  if (!res.ok) {
    throw new Error('Playground not found');
  }
  return res.json() as Promise<SharedPlayground>;
}
