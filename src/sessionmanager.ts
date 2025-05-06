import { codeSecret, TransferManager } from "./transfermanager.ts";

// управление сессиями трансфера файлов пользователей
export class SessionManager {
    transferManagers = new Map();

    constructor() {

    }


    getTransferManager(sessionSecret): TransferManager {
        if (!this.transferManagers.has(sessionSecret)) {
            const transferManager = new TransferManager(sessionSecret);
            this.transferManagers.set(transferManager.sessionSecret, transferManager)
            sessionSecret = transferManager.sessionSecret;
        }

        return this.transferManagers.get(sessionSecret);
    }

    getTransferManagerByCode(code): TransferManager {
        const sessionSecret = codeSecret.get(code);

        return this.transferManagers.get(sessionSecret);
    }



}