const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const apiRouter = require('./routes/api');

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.use('/api', apiRouter);

// Default: repo root / frontend / dist (local). In production (e.g. Dokploy) set FRONTEND_BUILD_PATH to where the build is in the container (e.g. /app/frontend/dist).
const frontendBuildPath =
  process.env.FRONTEND_BUILD_PATH ||
  path.resolve(__dirname, '..', '..', 'frontend', 'dist');

app.use(express.static(frontendBuildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});

