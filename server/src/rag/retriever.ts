import { prisma } from '../db.js';
import { generateEmbedding } from './embeddings.js';

export async function retrieveRelevantChunks(
  query: string,
  workspaceId: string,
  topK = 5,
): Promise<Array<{ content: string; metadata: any; similarity: number }>> {
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
