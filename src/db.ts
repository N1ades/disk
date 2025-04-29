import { DatabaseSync } from "node:sqlite";

export class SQLiteKV {
    filename: string;
    db: DatabaseSync;

    constructor(filename = './db.sqlite3') {
        this.filename = filename;
    }

    connect = () => {
        if (!this.db) {
            this.db = new DatabaseSync(this.filename);
        }
        return this.db;
    }

    collection = (name) => {
        this.connect();

        // Create table if not exists
        this.db.exec(`CREATE TABLE IF NOT EXISTS "${name}" (key TEXT PRIMARY KEY, value TEXT)`);

        return {
            set: (key, value) => {
                const serialized = JSON.stringify(value);
                this.db.prepare(`INSERT OR REPLACE INTO "${name}" (key, value) VALUES (?, ?)`).run(key, serialized);
            },

            get: (key) => {
                console.log({key});
                
                const result = this.db.prepare(`SELECT value FROM "${name}" WHERE key = ?`).get(key);
                return result ? JSON.parse(result.value) : null;
            },

            delete: (key) => {
                this.db.prepare(`DELETE FROM "${name}" WHERE key = ?`).run(key);
            },

            getAll: () => {
                const results = this.db.prepare(`SELECT key, value FROM "${name}"`).all();
                return results.map(row => ({
                    key: row.key,
                    value: JSON.parse(row.value)
                }));
            },

            clear: () => {
                this.db.prepare(`DELETE FROM "${name}"`).run();
            }
        };
    }
}


// // // Usage example

// try {
//     const kvStore = new SQLiteKV();

//     // Get or create collection
//     const users = kvStore.collection('users');

//     // Set key-value pair
//     users.set('john', { name: 'John Doe', age: 30 });

//     // Get value
//     const user = users.get('john');
//     console.log('User:', user);

//     // Get all entries
//     const allUsers = users.getAll();
//     console.log('All users:', allUsers);

//     // Delete entry
//     users.delete('john');

// } catch (error) {
//     console.error('Database error:', error);
// }