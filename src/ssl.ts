import { readFileSync } from 'fs';
import https from 'https';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';

export const startSsl = (app) => {
  const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
  const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
  const HOST = process.env.HOST || '127.0.0.1';
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  // Start HTTPS Server if SSL certs are provided
  if (SSL_KEY_PATH && SSL_CERT_PATH) {
    try {
      const privateKey = readFileSync(SSL_KEY_PATH, 'utf8');
      const certificate = readFileSync(SSL_CERT_PATH, 'utf8');

      const server = https.createServer(
        { key: privateKey, cert: certificate },
        app
      )

      server.listen(HTTPS_PORT, HOST, () => {
        console.log(`HTTPS server running on https://${HOST}:${HTTPS_PORT}`);
      });
    } catch (error) {
      console.error('Failed to start HTTPS server:', error.message);
    }
  }
};


export const createServer = () => {
  const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
  const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
  const HOST = process.env.HOST || '127.0.0.1';
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;


  const wsServers = []
  const app = express();

  if (process.env.PORT) {
    const server = http.createServer(app)

    server.listen(process.env.PORT, HOST, () => {
      console.log(`Server running on port http://${process.env.HOST}:${process.env.PORT}`);
    });

    const wss = new WebSocketServer({ server });
    wsServers.push(wss);
  }


  if (SSL_KEY_PATH && SSL_CERT_PATH) {
    const privateKey = readFileSync(SSL_KEY_PATH, 'utf8');
    const certificate = readFileSync(SSL_CERT_PATH, 'utf8');

    const server = https.createServer(
      { key: privateKey, cert: certificate },
      app
    )
    const wsss = new WebSocketServer({ server });
    wsServers.push(wsss);
    server.listen(HTTPS_PORT, HOST, () => {
      console.log(`HTTPS server running on https://${HOST}:${HTTPS_PORT}`);
    });
  }
  class WebSocketServers {
    on = (...params) => wsServers.map(wss => wss.on(...params))

    get clients() {
      return wsServers.map(wss => Array.from(wss.clients)).flat(1)
    }
  }


  // Use the custom CORS middleware
  app.use(cors({
    origin: process.env.ORIGIN ?? true,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }));
  
  app.use(morgan(':date :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent :res[header] :req[header] :response-time ms"'));
  

  return {
    wss: new WebSocketServers(),
    app: app
  }
}