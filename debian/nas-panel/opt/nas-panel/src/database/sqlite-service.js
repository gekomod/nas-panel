import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const STORAGE_KEY = 'naspanel_sqlite_db';
let dbInstance = null; // Zmieniamy nazwę na dbInstance dla jasności
let sqlite3Module = null;

export const getDB = () => {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  return dbInstance;
};

export const initDatabase = async () => {
  try {
   if (!sqlite3Module) {
    sqlite3Module = await sqlite3InitModule({
//      locateFile: file => `/node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm`,
//      locateFile: file => `/assets/${file}`,
  locateFile: file => {
    return new URL(`/node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/${file}`, import.meta.url).href
  },
      worker: () => new Worker(new URL('/node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3-worker1.js', import.meta.url))
    });
   }

    if (dbInstance) {
      return dbInstance;
    }

    const savedData = localStorage.getItem(STORAGE_KEY);
    const vfs = sqlite3Module.oo1.OpfsDb ? 'opfs' : 'memory';
    dbInstance = new sqlite3Module.oo1.DB(':memory:');

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS widgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        position INTEGER NOT NULL DEFAULT 0
      );
    `);

    if (savedData) {
      try {
        const widgets = JSON.parse(savedData);

        dbInstance.exec("BEGIN TRANSACTION");
        for (const widget of widgets) {
          dbInstance.exec({
            sql: "INSERT OR REPLACE INTO widgets (name, enabled, position) VALUES (?, ?, ?)",
            bind: [widget.name, widget.enabled, widget.position]
          });
        }
        dbInstance.exec("COMMIT");
      } catch (e) {
        dbInstance.exec("ROLLBACK");
      }
    } else {
      dbInstance.exec(`
        INSERT OR IGNORE INTO widgets (name, enabled, position) VALUES
          ('SystemInfoWidget', 1, 0),
          ('CpuWidget', 1, 1);
      `);
    }

    return dbInstance;
  } catch (err) {
    throw err;
  }
};

export const query = (sql, params = []) => {
  if (!dbInstance) throw new Error('Database not initialized');

  try {
    const result = dbInstance.exec({
      sql: sql,
      bind: params,
      returnValue: 'resultRows',
      rowMode: 'object'
    });

    if (!Array.isArray(result)) {
      console.warn('Unexpected query result format:', result);
      return [];
    }

    return result;
  } catch (err) {
    return [];
  }
};

export const saveDatabaseState = () => {
  if (!dbInstance) {
    console.error('Cannot save - database not initialized');
    return false;
  }

  try {
    const widgets = query("SELECT name, enabled, position FROM widgets");
    if (widgets.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
};

export const executeSQL = (sql, params = []) => {
  if (!dbInstance) throw new Error('Database not initialized');

  try {
    dbInstance.exec({ sql, bind: params });
    return true;
  } catch (err) {
    console.error('Execute error:', err);
    return false;
  }
};

export const loadDatabaseState = async () => {
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (!savedState) {
    return false;
  }

  try {
    const sqlite3 = await sqlite3InitModule({
      locateFile: file => `/node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm`
    });

    const bytes = new Uint8Array(JSON.parse(savedState));
    if (dbInstance) dbInstance.close();
    db = new sqlite3.oo1.DB(bytes);
    return true;
  } catch (err) {
    return false;
  }
};
