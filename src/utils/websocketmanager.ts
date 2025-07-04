export class WebsocketManager {
    open: boolean;
    url: any;
    eventListeners: {};
    ws?: WebSocket;

    reconectTimeout = () => setTimeout(() => {
        if (this.ws) {
            this.ws.close();
            delete this.ws;
        }
        this.eventListeners["reconect"]?.forEach((listener) => listener());
        console.log('Reconecting websocket');
        this.connect();
    }, 5000 + 2000)

    pingTimeout = this.reconectTimeout();

    constructor(url) {
        this.open = true;
        this.url = url;
        this.eventListeners = {};
        this.connect();
    }

    heartbeat = () => {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = this.reconectTimeout();
    }

    connect = () => {
        console.log('create WebSocket');

        this.ws = new WebSocket(this.url);

        this.ws.addEventListener("error", (event) => {
            this.heartbeat();
            console.error(event);

            this.eventListeners["error"]?.forEach((listener) => listener(event));
        });

        this.ws.addEventListener("open", (event) => {
            console.log("open");
            this.heartbeat();

            this.eventListeners["open"]?.forEach((listener) => listener(event));
        });

        this.ws.addEventListener("message", (event) => {
            
            if (typeof event.data !== 'string') {
                console.error('unsupported messageType');
                return;
            }

            if (event.data.length === 0) {
                this.heartbeat();
                return;
            }

            this.eventListeners["message"]?.forEach((listener) => listener(event));
        });

        this.ws.addEventListener("close", (event) => {
            console.log('close');
            if (this.open) {
                console.log('wait for reconnect');
                return // wait for reconnect
            }

            this.eventListeners["reconect"]?.forEach((listener) => listener());
            this.eventListeners["close"]?.forEach((listener) => listener(event));

        });
    }

    addEventListener = (type, listener, options) => {
        // this.eventListeners[type] = listener;
        this.eventListeners[type] ||= [];
        this.eventListeners[type].push(listener);
    }

    send = (data) => {
        this.ws.send(data);
    }

    close = () => {
        this.ws.close();
        delete this.ws;
        clearTimeout(this.pingTimeout);
        this.open = false;
        this.eventListeners = {};

    }

    _close = () => {
        this.ws.close();
    }
}
