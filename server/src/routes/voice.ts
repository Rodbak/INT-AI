import express, { Router } from 'express';
import OpenAI, { toFile } from 'openai';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { env } from '../env.js';

const router = Router();

let client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY || '' });
  }
  return client;
}

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
};

router.use(optionalAuth);
router.use(rateLimit);

router.post('/transcribe', express.raw({ type: 'audio/*', limit: '25mb' }), async (req, res) => {
  if (!env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'Voice transcription requires OPENAI_API_KEY to be configured' });
    return;
  }

  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    res.status(400).json({ error: 'No audio data received' });
    return;
  }

  const contentType = (req.headers['content-type'] || 'audio/webm').split(';')[0].trim();
  const ext = EXT_BY_MIME[contentType] || 'webm';

  try {
    const file = await toFile(buffer, `audio.${ext}`, { type: contentType });
    const transcription = await getClient().audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });
    res.json({ text: transcription.text });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message || 'Transcription failed' });
  }
});

const speechSchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
});

router.post('/speech', async (req, res) => {
  if (!env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'Voice synthesis requires OPENAI_API_KEY to be configured' });
    return;
  }

  try {
    const input = speechSchema.parse(req.body);

    const speechResponse = await getClient().audio.speech.create({
      model: 'tts-1',
      voice: input.voice || 'alloy',
      input: input.text,
      response_format: 'mp3',
    });

    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(502).json({ error: (error as Error).message || 'Speech synthesis failed' });
  }
});

export default router;
