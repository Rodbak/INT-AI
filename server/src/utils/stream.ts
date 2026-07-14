import type { StreamChunk } from '../types';

export function createSSEResponse(res: any) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

export function sendSSEChunk(res: any, chunk: StreamChunk) {
  const data = JSON.stringify(chunk);
  res.write(`data: ${data}\n\n`);
}

export function sendSSEEnd(res: any) {
  res.write('data: [DONE]\n\n');
  res.end();
}

export async function* streamToAsyncGenerator(
  stream: AsyncGenerator<StreamChunk, void, unknown>,
) {
  for await (const chunk of stream) {
    yield chunk;
  }
}
