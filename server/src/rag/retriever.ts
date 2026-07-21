import { prisma } from '../db.js';
import { generateEmbedding } from './embeddings.js';

type RetrievedChunk = { content: string; metadata: any; similarity: number };

/**
 * Retrieve context for a query. Uses pgvector similarity when an embeddings key
 * is configured, otherwise falls back to keyword (lexical) retrieval so RAG
 * works with no embeddings provider at all (e.g. an OpenRouter-only setup).
 */
export async function retrieveRelevantChunks(
  query: string,
  workspaceId: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await vectorRetrieve(query, workspaceId, topK);
    } catch {
      // Embeddings unavailable/failed — fall back to lexical.
    }
  }
  return retrieveLexicalChunks(query, workspaceId, topK);
}

/**
 * Keyword retrieval: score every chunk in the workspace by how often the
 * query's terms appear, and return the best matches. No embeddings required.
 */
export async function retrieveLexicalChunks(
  query: string,
  workspaceId: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  const terms = Array.from(new Set((query.toLowerCase().match(/[a-z0-9]{3,}/g) || [])));
  if (terms.length === 0) return [];

  const chunks = await prisma.documentChunk.findMany({
    where: { document: { workspaceId } },
    select: { content: true, documentId: true, document: { select: { title: true } } },
    take: 800,
  });

  const scored = chunks
    .map((c) => {
      const lc = c.content.toLowerCase();
      let score = 0;
      for (const t of terms) {
        let idx = lc.indexOf(t);
        while (idx !== -1) {
          score += 1;
          idx = lc.indexOf(t, idx + t.length);
        }
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const max = scored[0]?.score || 1;
  return scored.map(({ c, score }) => ({
    content: c.content,
    metadata: { documentId: c.documentId, documentTitle: c.document.title },
    similarity: score / max,
  }));
}

/** Store a document's text as retrievable chunks (no embeddings). */
export async function indexDocumentContent(documentId: string, content: string): Promise<void> {
  await prisma.documentChunk.deleteMany({ where: { documentId } });
  const chunks = await chunkText(content);
  const clean = chunks.map((c) => c.trim()).filter(Boolean);
  if (clean.length === 0) return;
  await prisma.documentChunk.createMany({
    data: clean.map((c) => ({ documentId, content: c, metadata: {} })),
  });
}

async function vectorRetrieve(
  query: string,
  workspaceId: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await generateEmbedding(query);

  const chunks = await prisma.$queryRaw<any[]>`
    SELECT 
      dc.id,
      dc.content,
      dc.metadata,
      dc.document_id,
      d.title as document_title,
      1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON dc.document_id = d.id
    WHERE d.workspace_id = ${workspaceId}
    ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${topK}
  `;

  return chunks.map((chunk) => ({
    content: chunk.content,
    metadata: {
      documentId: chunk.document_id,
      documentTitle: chunk.document_title,
      ...chunk.metadata,
    },
    similarity: chunk.similarity,
  }));
}

export async function indexDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  await prisma.documentChunk.deleteMany({
    where: { documentId },
  });

  const text = `Title: ${document.title}\nFilename: ${document.filename}`;
  const chunks = await chunkText(text);

  for (const chunkContent of chunks) {
    const embedding = await generateEmbedding(chunkContent);

    await prisma.documentChunk.create({
      data: {
        documentId,
        content: chunkContent,
        embedding: embedding as any,
        metadata: {
          filename: document.filename,
          mimeType: document.mimeType,
          size: document.size,
        },
      },
    });
  }
}

async function chunkText(text: string, maxChunkSize = 1000, overlap = 200): Promise<string[]> {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += maxChunkSize - overlap;
  }

  return chunks;
}
