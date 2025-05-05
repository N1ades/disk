import { ChunkManager } from "./chunk.ts";
import { db } from "./db.ts";




type FileClientMeta = {
    path: string;
    size: number;
    type: string;
    lastModified: number;
};

const files = db.collection('files');

export class FileManager {

    filesMap = new Map();

    addFiles = (files: FileClientMeta[]) => {
        for (const file of files) {
            this.filesMap.set(file.path, file);
        }
    }

    deleteFiles = (files: FileClientMeta[]) => {
        for (const file of files) {
            this.filesMap.delete(file.path);
        }
    }
}