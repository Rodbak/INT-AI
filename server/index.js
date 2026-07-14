import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key before starting the server.',
  );
  process.exit(1);
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

const client = new Anthropic();
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { message } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    res.json({ reply: textBlock?.text ?? '' });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      res.status(401).json({ error: 'Invalid or missing Anthropic API key.' });
    } else if (error instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'Rate limited by Anthropic. Try again shortly.' });
    } else if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error:', error.status, error.message);
      res.status(502).json({ error: 'The model provider returned an error.' });
    } else {
      console.error('Unexpected error calling Anthropic:', error);
      res.status(500).json({ error: 'Unexpected server error.' });
    }
  }
});

if (isProduction) {
  const distDir = path.join(__dirname, '..', 'app', 'dist');
  app.use(express.static(distDir));
  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`INT AI Workspace server listening on http://localhost:${PORT} (model: ${MODEL})`);
});
