import { FileManager } from "./filemanager.ts";
import { WebsocketManager } from "./websocketmanager.ts";
import { throttle } from 'throttle-debounce';


const MessageType = {
    INIT: 0,
    DATA: 1,
    REQUEST: 2,
    FILES: 3,
    FILES_CLIENT_META: 4,
    FILES_CLIENT_DELETION: 5
};
type FileClientMeta = {
    path: string;
    size: number;
    // type: string;
    // lastModified: number;
};


type FileInfo = {
    lastModified: number;
    name: string;
    size: number;
    type: string;
};

type FileEntry = {
    depth: number;
    file: {
        lastModified: number;
        lastModifiedDate: string;
        name: string;
        size: number;
        type: string;
        webkitRelativePath: string;
    };
    info: FileInfo & {
        path: string;
        progress: number;
    };
};

// type FileMeta = {
//     lastModified: number;
//     name: string;
//     size: number;
//     type: string;
// };

export class TransferManager {

    filesInfo = new Map();
    fileManager = new FileManager();
    ws = new WebsocketManager(`${location.protocol.includes('s') ? 'wss' : 'ws'}://${location.host}`);


    sendClientMeta = (payload: FileClientMeta[]) => {
        const encoder = new TextEncoder();
        const jsonBytes = encoder.encode(JSON.stringify(payload));
        const buffer = new Uint8Array(8 + jsonBytes.length);

        buffer.set(new Uint8Array(new BigInt64Array([BigInt(MessageType.FILES_CLIENT_META)]).buffer), 0);
        buffer.set(jsonBytes, 8);
        this.ws.send(buffer);

    }

    constructor() {
        this.fileManager.addEventListener('change', (files) => {
            const payload: FileClientMeta[] = files.map((item) => {
                return {
                    path: item.path,
                    size: item.file.size,
                }
            })

            this.sendClientMeta(payload)

        })

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
            console.log('ws send init');

            // totalBytesSent += buffer.byteLength;
            if (this.filesInfo.size) {
                this.sendClientMeta(Array.from(this.filesInfo.values()).map(({ path, size }) => ({ path, size })))
            }
        });

        this.ws.addEventListener('message', async (event) => {
            if (typeof event.data !== 'string') {
                console.error('unsupported messageType');
                console.log(typeof event.data);
                return
            }

            const data = JSON.parse(event.data);

            if (data.sessionSecret) {
                console.log('sessionSecret', data.sessionSecret);

                this.sessionSecret = data.sessionSecret;
            }

            if (Array.isArray(data)) {
                for (const file of data) {

                    if (file.deleted) {
                        this.fileManager.rawFiles.delete(file.path);
                        this.filesInfo.delete(file.path);
                    } else {
                        file.progress = 0;
                        this.filesInfo.set(file.path, file);
                    }
                }

                this.callFilesChangedThrottled();
                return
            }

            if (typeof data.chunkId === 'number') {

                const chunk = data;
                const file = this.fileManager.rawFiles.get(chunk.path);

                const reader = new FileReader();
                reader.onload = (event) => {
                    const buffer = new Uint8Array(event.target.result);
                    const combined = new Uint8Array(8 + 8 + buffer.byteLength);
                    combined.set(new Uint8Array(new BigInt64Array([BigInt(MessageType.DATA)]).buffer), 0);
                    combined.set(new Uint8Array(new BigInt64Array([BigInt(chunk.chunkId)]).buffer), 8);
                    combined.set(buffer, 16);
                    this.ws.send(combined);
                    // totalBytesSent += combined.byteLength;
                };
                const blob = file.slice(chunk.rangeStart, chunk.rangeEnd === -1 ? undefined : chunk.rangeEnd + 1);
                reader.readAsArrayBuffer(blob);
            }
        }
        )

    }


    removeFile = (path: string) => {
        const filesToRemove = Array.from(this.filesInfo.keys()).filter((key: string) => key === path || key.startsWith(path + `/`));

        const jsonPayload = JSON.stringify(filesToRemove)

        const encoder = new TextEncoder();
        const jsonBytes = encoder.encode(jsonPayload);
        const buffer = new Uint8Array(8 + jsonBytes.length);

        buffer.set(new Uint8Array(new BigInt64Array([BigInt(MessageType.FILES_CLIENT_DELETION)]).buffer), 0);
        buffer.set(jsonBytes, 8);


        this.ws.send(buffer);
    }


    callFilesChangedThrottled = throttle(1000, () => {
        const filess = Array.from(this.filesInfo.values())

        this.eventListeners["change"]?.forEach((listener) => listener(filess));
    })

    destroy = () => {
        this.ws.close();
    }


    eventListeners: any = {};
    addEventListener = (type: string, listener: Function) => {
        // this.eventListeners[type] = listener;
        this.eventListeners[type] ||= [];
        this.eventListeners[type].push(listener);
    }
}