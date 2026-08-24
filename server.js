import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable JSON body parsing for potential future API proxy routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint for container orchestrators (Kubernetes, Docker Swarm, AWS ECS, GCP Cloud Run)
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'pcp-analise-carga-maquina',
  });
});

// Serve static assets with caching headers
const distPath = path.resolve(__dirname, 'dist');
app.use(
  express.static(distPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      // Long-term cache for immutable Vite hashed assets
      if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        // Never cache HTML to ensure instant updates
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// SPA Client-side routing fallback: send index.html for all non-static requests
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`[PCP Sistema] Servidor operacional iniciado com sucesso!`);
  console.log(`[PCP Sistema] Acesso local: http://localhost:${PORT}`);
  console.log(`[PCP Sistema] Rede corporativa: http://${HOST}:${PORT}`);
  console.log(`[PCP Sistema] Health Check: http://${HOST}:${PORT}/api/health`);
});
