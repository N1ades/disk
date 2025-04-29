
import express from 'express';
import { ServerResponse } from 'http';
import fs from 'fs';
import morgan from 'morgan';
import path from 'path';
import mime from 'mime-types';
import { createServer } from './ssl.ts'
import { nanoid } from 'nanoid'
import { FileObject } from './file.ts';
import { ChunkManager } from './chunk.ts';
import { SQLiteKV } from './db.ts';

const tryCatch = (func, fail) => {
  try { return func() }
  catch (e) { return fail }
}

const __dirname = import.meta.dirname;
const { wss, app } = createServer();
//  // Используем один сервер для HTTP и WS

const uploadsDir = path.join(__dirname, 'uploads');

const database = new SQLiteKV('./db.sqlite3');


const filesMap = new Map<string, FileObject>();

// Создаем директории при необходимости
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(morgan(':date :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent :res[header] :req[header] :response-time ms"'));
app.use(express.static('public'));

function heartbeat() {
  //console.log('pong');

  this.isAlive = true;
}

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    // console.log(ws.isAlive);
    ws.send('');
    ws.ping();
  });
}, 1000);

// setInterval(function ping() {
//   wss.clients.forEach(function each(ws) {
//     console.log(ws.isAlive);
//   });
// }, 100);

wss.on('close', function close() {
  clearInterval(interval);
});

// WebSocket обработчик
const chunkManager = new ChunkManager()

wss.on('connection', (ws) => {

  ws.isAlive = true;
  ws.on('error', console.error);
  ws.on('pong', heartbeat);

  ws.on('message', async (message) => {
    // console.log(message);
    const MessageType = {
      INIT: 0,
      DATA: 1,
      REQUEST: 2,
      FILES: 3,
    }

    const messageType = Number(message.readBigInt64LE(0));

    if (messageType === MessageType.INIT) {
      const data = message.slice(8);
      if (data.length > 1_000_000) {
        throw new Error('Payload too large');
      }
      console.log('init');


      // const { size, filename, sessionSecret } = JSON.parse(data.toString('utf8'));
      const { sessionSecret } = JSON.parse(data.toString('utf8'));

      if (
        // typeof size !== 'number' ||
        // typeof filename !== 'string' ||
        typeof sessionSecret !== 'string' && typeof sessionSecret !== 'undefined'
      ) {
        throw new Error('Invalid input types');
      }

      const existsCode = sessionSecret && database.collection('secret').get(sessionSecret);
      const secret = (existsCode && sessionSecret) ?? nanoid();
      const code = existsCode ?? nanoid();

      console.log({ secret });
      if (filesMap.has(secret)) {

        filesMap.get(secret)?.getWs().close();
        console.log('old ws closed');
        
        // throw new UniqueKeyConflictError()
      }

      if (!existsCode) {
        database.collection('secret').set(code, secret);
        database.collection('secret').set(secret, code);
      }

      console.log('send Link');

      ws.send(JSON.stringify({
        sessionSecret: secret,
        // downloadLink: `/files/${encodeURIComponent(code)}/${encodeURIComponent(filename)}`
      }));
      // const file = new FileObject(filename, size, () => ws, secret, chunkManager);

      // filesMap.set(secret, file); // min chunk is 1mb index Buffer stores states of those chunks
    }

    if (messageType === MessageType.FILES) {
      
    }


    if (messageType === MessageType.DATA) {
      // Обработка бинарных данных
      const chunkId = Number(message.readBigInt64LE(8));
      const data = message.slice(16);

      chunkManager.setData(chunkId, data);
    }
  });
});

class NotFoundError extends Error {
  code = 'ENOENT'
}
class UniqueKeyConflictError extends Error {
  code = 'ENOENT'
}

app.get('/files/:code/:filename', async (req, res: ServerResponse) => {
  try {
    const filename = req.params.filename;
    const code = req.params.code;
    // console.log(filename);
    const secret = database.collection('secret').get(code);

    if (!filesMap.has(secret)) {
      throw new NotFoundError()
    }
    const file = filesMap.get(secret) as FileObject

    // const filePath = path.join(__dirname, 'uploads', filename);

    // Get file stats
    // const stats = await fs.promises.stat(filePath);
    // const fileSize = stats.size;
    const fileSize = file.size;
    let range = req.headers.range;

    console.log(new Date(), req.headers);



    // Determine Content-Type
    const contentType = mime.lookup(filename) || 'application/octet-stream';

    if (!range) {
      // Send full file if no range header
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes'
      });

      {
        const chunkSize = 3 * 1024 * 1024; // 3MB
        let current = 0;

        while (current <= fileSize - 1) {
          const next = Math.min(current + chunkSize - 1, fileSize - 1);
          const chunk = await file.read(current, next);

          if (!res.write(chunk)) {
            // Wait for the 'drain' event before continuing
            await new Promise(resolve => res.once('drain', resolve));
          }

          current = next + 1;
          await new Promise(resolve => setTimeout(resolve, 5)); // Wait 5ms before next read
        }
      }


      return res.end();
    }

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
    // filesMap.delete(secret);

    {
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

