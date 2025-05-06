import pkg from 'http-proxy';
const { createProxyServer } = pkg;

export const websocketProxyPlugin = ({ target, wsPathFilter = (url) => true }) => {
    const proxy = createProxyServer({
        target,
        ws: true,
        changeOrigin: true,
        secure: false, // skip if using self-signed certs
    });

    proxy.on('error', (err, req, socket) => {
        console.error('[WS Proxy Error]', err.message);
        if (socket.writable) {
            socket.end('HTTP/1.1 500 WebSocket Proxy Error\r\n\r\n');
        }
    });

    return {
        name: 'vite-plugin-ws-proxy',

        configureServer(server) {
            server.httpServer.on('upgrade', (req, socket, head) => {
                if (wsPathFilter(req.url)) {
                    proxy.ws(req, socket, head);
                }
            });
        },
    };
}