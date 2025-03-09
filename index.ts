
import express from 'express';
import { ServerResponse } from 'http';
import fs from 'fs';
import morgan from 'morgan';
import path from 'path';
import mime from 'mime-types';
import { createServer } from './ssl.ts'

const __dirname = import.meta.dirname;
const { wss, app } = createServer();
//  // Используем один сервер для HTTP и WS

const uploadsDir = path.join(__dirname, 'uploads');



class ChunkManager {
  chunkId = 0;
  chunksMap = new Map<number, any>();

  createChunk = (cb) => {
    const chunkId = this.chunkId++;
    this.chunksMap.set(chunkId, cb);
    // console.log('createChunk', chunkId);
    return { chunkId };
  }

  setData = (chunkId, data) => {
    // console.log('setData', chunkId);

    this.chunksMap.get(chunkId)(data);
    this.chunksMap.delete(chunkId);
  }

}
const chunkManager = new ChunkManager()

class FileObject {
  indexBufferMB: number[];
  getWs: any;
  filename: string;
  size: number;

  constructor(filename, size, getWs) {
    this.size = size
    this.filename = filename
    this.getWs = getWs;
    this.indexBufferMB = []
  }

  write = (chunkId, data) => {
    chunkManager.setData(chunkId, data)
  }

  read = (rangeStart: number, rangeEnd: number) => {

    return new Promise<void>((resolve, reject) => {
      const { chunkId } = chunkManager.createChunk(resolve);

      this.getWs().send(JSON.stringify({
        filename: this.filename,
        chunkId,
        rangeStart,
        rangeEnd
      }));
    })
  }

}

const filesMap = new Map<string, FileObject>();

// Создаем директории при необходимости
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(morgan(':date :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent :res[header] :req[header] :response-time ms"'));

app.use(express.static('public'));


// WebSocket обработчик
wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    // console.log(message);
    const MessageType = {
      INIT: 0,
      DATA: 1
    }

    const messageType = Number(message.readBigInt64LE(0));

    // console.log({ messageType });

    if (messageType === MessageType.INIT) {
      // Получение метаданных
      const data = message.slice(8);
      const { size, filename } = JSON.parse(data.toString('utf8'));

      // console.log({ size, filename });

      ws.send(JSON.stringify({
        downloadLink: `/files/${encodeURIComponent(filename)}`
      }));

      filesMap.set(filename, new FileObject(filename, size, () => ws)) // min chunk is 1mb index Buffer stores states of those chunks

    }
    if (messageType === MessageType.DATA) {
      // Обработка бинарных данных
      const chunkId = Number(message.readBigInt64LE(8));
      const data = message.slice(16);

      chunkManager.setData(chunkId, data);

    }
  });
});

// HTTP endpoint для скачивания
app.get('/download', (req, res) => {
  const { filename, rangeStart, rangeEnd } = req.query;
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  const start = parseInt(rangeStart, 10) || 0;
  const end = rangeEnd === '-1' ? fileSize - 1 : Math.min(parseInt(rangeEnd, 10), fileSize - 1);

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${fileSize}`
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

class NotFoundError extends Error {
  code = 'ENOENT'
}

app.get('/files/:filename', async (req, res: ServerResponse) => {
  try {
    const filename = req.params.filename;
    // console.log(filename);

    if (!filesMap.has(filename)) {
      throw new NotFoundError()
    }
    const file = filesMap.get(filename) as FileObject

    // const filePath = path.join(__dirname, 'uploads', filename);

    // Get file stats
    // const stats = await fs.promises.stat(filePath);
    // const fileSize = stats.size;
    const fileSize = file.size;
    let range = req.headers.range;

    console.log(new Date(), req.headers);



    // Determine Content-Type
    const contentType = mime.lookup(filename) || 'application/octet-stream';

    // if (!range) {
    //   // Send full file if no range header
    //   res.writeHead(200, {
    //     'Content-Type': contentType,
    //     'Content-Length': fileSize,
    //     'Accept-Ranges': 'bytes'
    //   });

    //   res.write(await file.read(0, -1))
    //   return res.end();
    // }

    // Parse Range header (bytes=start-end)
    // console.log({range});
    let start, end;

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      start = parseInt(startStr, 10);
      end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    }
    else {
      start = 0;
      end = fileSize - 1;
    }

    // Validate range
    if (start > end || end >= fileSize) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`
      });
      return res.end();
    }

    // const MAX_CHUNK_SIZE = 1000000;
    // end = Math.min(end, fileSize - 1, start + MAX_CHUNK_SIZE);

    // Adjust end if out of bounds
    end = Math.min(end, fileSize - 1);

    const contentLength = end - start + 1;

    // Send partial content
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': contentLength,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });

    // res.write(await file.read(start, end));

    const chunkSize = 2 * 1024 * 1024; // 2MB
    let current = start;

    while (current <= end) {
      const next = Math.min(current + chunkSize - 1, end);
      const chunk = await file.read(current, next);

      if (!res.write(chunk)) {
        // Wait for the 'drain' event before continuing
        await new Promise(resolve => res.once('drain', resolve));
      }

      current = next + 1;
      await new Promise(resolve => setTimeout(resolve, 5)); // Wait 5ms before next read
    }

    res.end();
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).send('File not found');
    } else {
      console.error(err);
      res.status(500).send('Internal server error');
    }
  }
});

