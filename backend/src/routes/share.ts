import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { createPlayground, getPlayground, updatePlayground, deletePlayground } from '../db/queries.js';
import { verifyIdentity } from '../auth.js';

interface SharePluginOptions {
  db: Database.Database;
}

export async function shareRoutes(app: FastifyInstance, opts: SharePluginOptions) {
  const { db } = opts;

  // Create playground
  app.post<{
    Body: {
      source: string;
      language: string;
      title?: string;
      tab?: string;
      unlockInputs?: string;
      networkEndpoint?: string;
      identityKey: string;
      signature: string;
    };
  }>('/playgrounds', async (request, reply) => {
    const { source, language, title, tab, unlockInputs, networkEndpoint, identityKey, signature } = request.body;

    if (!source || !language || !identityKey || !signature) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Verify identity
    const valid = await verifyIdentity(identityKey, signature, source);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const playground = createPlayground(db, {
      source,
      language,
      title,
      tab,
      unlockInputs,
      networkEndpoint,
      ownerIdentityKey: identityKey,
    });

    return reply.status(201).send({
      id: playground.id,
      url: `${request.protocol}://${request.hostname}/p/${playground.id}`,
      createdAt: playground.created_at,
    });
  });

  // Get playground
  app.get<{ Params: { id: string } }>('/playgrounds/:id', async (request, reply) => {
    const playground = getPlayground(db, request.params.id);
    if (!playground) {
      return reply.status(404).send({ error: 'Playground not found' });
    }

    return {
      id: playground.id,
      source: playground.source,
      language: playground.language,
      title: playground.title,
      tab: playground.tab,
      unlockInputs: playground.unlock_inputs,
      networkEndpoint: playground.network_endpoint,
      ownerIdentityKey: playground.owner_identity_key,
      createdAt: playground.created_at,
      updatedAt: playground.updated_at,
    };
  });

  // Update playground
  app.put<{
    Params: { id: string };
    Body: {
      source?: string;
      language?: string;
      title?: string;
      tab?: string;
      unlockInputs?: string;
      networkEndpoint?: string;
      identityKey: string;
      signature: string;
    };
  }>('/playgrounds/:id', async (request, reply) => {
    const playground = getPlayground(db, request.params.id);
    if (!playground) {
      return reply.status(404).send({ error: 'Playground not found' });
    }

    const { identityKey, signature, ...data } = request.body;

    // Verify ownership
    if (identityKey !== playground.owner_identity_key) {
      return reply.status(403).send({ error: 'Not the owner of this playground' });
    }

    const valid = await verifyIdentity(identityKey, signature, data.source ?? playground.source);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    updatePlayground(db, request.params.id, data);
    return { ok: true };
  });

  // Delete playground
  app.delete<{
    Params: { id: string };
    Body: {
      identityKey: string;
      signature: string;
    };
  }>('/playgrounds/:id', async (request, reply) => {
    const playground = getPlayground(db, request.params.id);
    if (!playground) {
      return reply.status(404).send({ error: 'Playground not found' });
    }

    const { identityKey, signature } = request.body;

    if (identityKey !== playground.owner_identity_key) {
      return reply.status(403).send({ error: 'Not the owner of this playground' });
    }

    const valid = await verifyIdentity(identityKey, signature, playground.source);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    deletePlayground(db, request.params.id);
    return { ok: true };
  });
}
