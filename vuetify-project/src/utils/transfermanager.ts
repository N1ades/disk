import { FileManager } from "./filemanager.ts";
import { WebsocketManager } from "./websocketmanager.ts";

const MessageType = {
    INIT: 0,
    DATA: 1,
    REQUEST: 2,
    FILES: 3,
};


export class TransferManager {

    constructor() {
        this.fileManager = new FileManager();

        this.ws = new WebsocketManager(`${location.protocol.includes('s') ? 'wss' : 'ws'}://${location.host}`);

        this.ws.addEventListener('open', () => {
            console.log('open');

            const jsonPayload = JSON.stringify({
                sessionSecret: this.sessionSecret
            });
            const encoder = new TextEncoder();
            const jsonBytes = encoder.encode(jsonPayload);
            const buffer = new Uint8Array(8 + jsonBytes.length);

            buffer.set(new Uint8Array(new BigInt64Array([BigInt(MessageType.INIT)]).buffer), 0);
            buffer.set(jsonBytes, 8);
            console.log('send init');

            this.ws.send(buffer);

            // totalBytesSent += buffer.byteLength;
        });


        this.ws.addEventListener('message', async (event) => {
            if (event.data.length === 0) {
                console.log('received ping');

                return
            }

            console.log(typeof event.data);

            if (typeof event.data === 'string') {
                const data = JSON.parse(event.data);

                if (data.sessionSecret) {
                    this.sessionSecret = data.sessionSecret;
                }

                if (data.files) {
                    for (const file of data.files) {
                        console.log(`📄 ${file.name} - Live`);
                        console.log('downloadLink:', new URL(file.downloadLink, window.location.protocol + '//' + window.location.host).toString());
                    }
                }

                // if (data.filename) {
                //     const chunk = data;
                //     const file = files.find(({ filename }) => filename === chunk.filename);

                //     const reader = new FileReader();
                //     reader.onload = (e) => {
                //         const buffer = new Uint8Array(e.target.result);
                //         const combined = new Uint8Array(8 + 8 + buffer.byteLength);
                //         combined.set(new Uint8Array(new BigInt64Array([BigInt(MessageType.DATA)]).buffer), 0);
                //         combined.set(new Uint8Array(new BigInt64Array([BigInt(chunk.chunkId)]).buffer), 8);
                //         combined.set(buffer, 16);
                //         ws.send(combined);
                //         // totalBytesSent += combined.byteLength;
                //     };
                //     const blob = file.slice(chunk.rangeStart, chunk.rangeEnd === -1 ? undefined : chunk.rangeEnd + 1);
                //     reader.readAsArrayBuffer(blob);
                // }
            } else {
                console.error('unsupported messageType');
            }
        })

    }

    destroy = () => {
        this.ws.close();
    }
}