import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { readFileSync, createWriteStream, existsSync, mkdirSync  } from 'fs';
import path from 'path';
import cors from 'cors';
import { statfs } from 'fs/promises';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '500');
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
// Добавьте в конфигурацию
const CHUNK_DIR = path.join(UPLOAD_DIR, '.chunks');
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Создайте директории
[UPLOAD_DIR, CHUNK_DIR].forEach(dir => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});


// Middleware
app.use(cors());
app.use(express.static('public'));
app.use('/files', express.static(UPLOAD_DIR));
app.use(express.json({ limit: `${MAX_FILE_SIZE_MB}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${MAX_FILE_SIZE_MB}mb` }));

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true });




// Multer configuration
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, true);
    return;
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// API Endpoints
app.get('/api/files', async (req, res) => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const filesData = await Promise.all(files.map(async (file) => {
      const stat = await fs.stat(path.join(UPLOAD_DIR, file));
      return {
        name: file,
        size: stat.size,
        uploadedAt: stat.birthtime.toISOString(),
        downloadUrl: `/files/${encodeURIComponent(file)}`
      };
    }));
    res.json(filesData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    res.json({ message: 'File uploaded successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/files/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    await fs.unlink(path.join(UPLOAD_DIR, filename));
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.get('/api/disk-space', async (req, res) => {
  try {
    const stats = await statfs(UPLOAD_DIR);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    const used = total - free;
    res.json({ total, used, free });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start HTTP Server
app.listen(PORT, HOST, () => {
  console.log(`HTTP server running on http://${HOST}:${PORT}`);
});

// Start HTTPS Server if SSL certs are provided
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

if (SSL_KEY_PATH && SSL_CERT_PATH) {
  try {
    const privateKey = readFileSync(SSL_KEY_PATH, 'utf8');
    const certificate = readFileSync(SSL_CERT_PATH, 'utf8');

    https.createServer(
      { key: privateKey, cert: certificate },
      app
    ).listen(HTTPS_PORT, HOST, () => {
      console.log(`HTTPS server running on https://${HOST}:${HTTPS_PORT}`);
    });
  } catch (error) {
    console.error('Failed to start HTTPS server:', error.message);
  }
}

