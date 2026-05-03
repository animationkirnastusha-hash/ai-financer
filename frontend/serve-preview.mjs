import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4173);

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

app.use(
  '/api',
  createProxyMiddleware({
    target: `${backendUrl}/api`,
    changeOrigin: true,
  }),
);

app.use(
  '/health',
  createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
  }),
);

app.use(express.static(path.join(__dirname, 'dist')));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AI-financer preview: http://localhost:${port}`);
  console.log(`Proxy /api -> ${backendUrl}/api`);
});