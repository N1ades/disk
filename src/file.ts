import { ChunkManager } from "./chunk.ts";


export class FileObject {
    indexBufferMB: number[];
    getWs: any;
    filename: string;
    size: number;
    chunkManager: ChunkManager;

    constructor(filename, size, getWs, sessionSecret, chunkManager) {
        
        this.size = size
        this.filename = filename
        this.getWs = getWs;
        this.indexBufferMB = []

        this.chunkManager = chunkManager;
    }

    write = (chunkId, data) => {
        this.chunkManager.setData(chunkId, data)
    }

    read = (rangeStart: number, rangeEnd: number) => {

        return new Promise<void>((resolve, reject) => {
            const { chunkId } = this.chunkManager.createChunk(resolve);

            this.getWs().send(JSON.stringify({
                filename: this.filename,
                chunkId,
                rangeStart,
                rangeEnd
            }));
        })
    }

}