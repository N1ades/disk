
import '@dotenvx/dotenvx/config'
import express from 'express';
import { ServerResponse } from 'http';
import fs from 'fs';
import morgan from 'morgan';
import path from 'path';
import mime from 'mime-types';
import { createServer } from './ssl.ts'
import { SessionManager } from './sessionmanager.ts';
import { TransferManager } from './transfermanager.ts';
import cors from 'cors';

// const __dirname = import.meta.dirname;
const { wss, app } = createServer();

// Use the custom CORS middleware
app.use(cors({
  origin: process.env.ORIGIN ?? true,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

app.use(morgan(':date :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent :res[header] :req[header] :response-time ms"'));

app.use('/assets', express.static('client/dist/assets', {
  maxAge: '1y', // cache for 1 year
  immutable: true // tells browser the content won't change
}));

// Serve the rest of the static files (like index.html, main JS bundle, etc.)
app.use(express.static('client/dist'));

function heartbeat() {
  this.isAlive = true;
}

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.send('');
    ws.ping();
  });
}, 2000);

// setInterval(function ping() {
//   wss.clients.forEach(function each(ws) {
//   });
// }, 100);

wss.on('close', function close() {
  clearInterval(interval);
});

// WebSocket обработчик

const sessionManager = new SessionManager();

wss.on('connection', (ws) => {

  ws.isAlive = true;
  ws.on('error', console.error);
  ws.on('pong', heartbeat);

  const chunkRequest = (chunk) => {

    ws.send(JSON.stringify(chunk));
  }

  ws.on('close', () => {
    ws.transferManager?.chunkManager.removeEventListener('chunk', chunkRequest);
  })

  ws.on('message', async (message) => {

    const MessageType = {
      INIT: 0,
      DATA: 1,
      REQUEST: 2,
      FILES: 3,
      FILES_CLIENT_META: 4,
      FILES_CLIENT_DELETION: 5
    };

    const messageType = Number(message.readBigInt64LE(0));

    if (messageType === MessageType.INIT) {
      const data = message.slice(8);
      if (data.length > 1_000_000) {
        throw new Error('Payload too large');
      }

      const { sessionSecret } = JSON.parse(data.toString('utf8'));

      if (
        typeof sessionSecret !== 'string' && typeof sessionSecret !== 'undefined'
      ) {
        throw new Error('Invalid input types');
      }

      ws.transferManager ??= sessionManager.getTransferManager(sessionSecret);
      ws.transferManager.chunkManager.addEventListener('chunk', chunkRequest);

      ws.send(JSON.stringify({
        sessionSecret: ws.transferManager.sessionSecret,
        code: ws.transferManager.code
      }));

    }

    const transferManager: TransferManager = ws.transferManager;

    if (!transferManager) {
      ws.terminate();
      return
    }

    type FileClientMeta = {
      path: string;
      size: number;
      type: string;
      lastModified: number;
    };


    if (messageType === MessageType.FILES_CLIENT_META) {

      const data = message.slice(8);
      const decoder = new TextDecoder();

      const files: FileClientMeta[] = JSON.parse(decoder.decode(data));


      transferManager.fileManager.addFiles(files);

      ws.send(JSON.stringify(
        files.map((file) => {
          return {
            path: file.path,
            link: `${transferManager.code}/${file.path}`,
            size: file.size,
            // deleted: false
          }
        })
      ));

      // send not answered data requests again
    }


    if (messageType === MessageType.FILES_CLIENT_DELETION) {
      const data = message.slice(8);
      const decoder = new TextDecoder();

      const filesToRemove: string[] = JSON.parse(decoder.decode(data));

      transferManager.fileManager.deleteFiles(filesToRemove);

      ws.send(JSON.stringify(
        filesToRemove.map((filePath) => {
          return {
            path: filePath,
            deleted: true
          }
        })
      ));
    }


    if (messageType === MessageType.DATA) {
      // Обработка бинарных данных
      const chunkId = Number(message.readBigInt64LE(8));
      const data = message.slice(16);

      transferManager.chunkManager.setData(chunkId, data);
    }
  });
});

class NotFoundError extends Error {
  code = 'ENOENT'
}
class UniqueKeyConflictError extends Error {
  code = 'ENOENT'
}

app.get('/:code/*', async (req, res: ServerResponse) => {
  try {

    const path = req.params[0];
    const code = req.params.code;

    const transferManager = sessionManager.getTransferManagerByCode(code);


    if (!transferManager) {
      throw new NotFoundError()
    }

    const file = transferManager.fileManager.filesMap.get(path);




    if (!file) {
      throw new NotFoundError()
    }

    let range = req.headers.range;

    // Determine Content-Type
    const contentType = mime.lookup(path) || 'application/octet-stream';

    if (!range) {
      // Send full file if no range header
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': file.size,
        'Accept-Ranges': 'bytes'
      });

      {
        const chunkSize = 2 * 1024 * 1024; // 2MB
        let current = 0;

        while (current <= file.size - 1) {
          const next = Math.min(current + chunkSize - 1, file.size - 1);
          const chunks = await transferManager.chunkManager.read(file, current, next);

          for (const chunk of chunks) {
            if (!res.write(chunk)) {
              // Wait for the 'drain' event before continuing
              await new Promise(resolve => res.once('drain', resolve));
            }
          }

          current = next + 1;
          await new Promise(resolve => setTimeout(resolve, 5)); // Wait 5ms before next read
        }
      }


      return res.end();
    }

    // Parse Range header (bytes=start-end)
    let start, end;

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      start = parseInt(startStr, 10);
      end = endStr ? parseInt(endStr, 10) : file.size - 1;
    }
    else {
      start = 0;
      end = file.size - 1;
    }

    // Validate range
    if (start > end || end >= file.size) {
      res.writeHead(416, {
        'Content-Range': `bytes */${file.size}`
      });
      return res.end();
    }

    // Adjust end if out of bounds
    end = Math.min(end, file.size - 1);

    const contentLength = end - start + 1;

    // Send partial content
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${file.size}`,
      'Content-Length': contentLength,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });

    {
      const chunkSize = 2_000_000; // 2MB
      let current = start;

      while (current <= end) {
        const next = Math.min(current + chunkSize - 1, end);
        const chunks = await transferManager.chunkManager.read(file, current, next);


        for (const chunk of chunks) {
          if (!res.write(chunk)) {
            // Wait for the 'drain' event before continuing
            await new Promise(resolve => res.once('drain', resolve));
          }
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

