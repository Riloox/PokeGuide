import express from 'express';
import path from 'path';
import cors from 'cors';
import compression from 'compression';

const app = express();
app.use(cors());
app.use(compression());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
