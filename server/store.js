import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(here, "data", "seed.json");
const localPath = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(here, "data", "local-state.json");

async function readSeed() {
  return JSON.parse(await readFile(seedPath, "utf8"));
}

class FileStore {
  async init() {
    try {
      await readFile(localPath, "utf8");
    } catch {
      await writeFile(localPath, JSON.stringify(await readSeed(), null, 2));
    }
  }

  async getState() {
    return JSON.parse(await readFile(localPath, "utf8"));
  }

  async setState(state) {
    const temporaryPath = `${localPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state, null, 2));
    await rename(temporaryPath, localPath);
  }

  async close() {}
}

class PostgresStore {
  constructor(connectionString) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const existing = await this.pool.query("SELECT id FROM app_state WHERE id = 1");
    if (existing.rowCount === 0) {
      await this.pool.query("INSERT INTO app_state (id, data) VALUES (1, $1::jsonb)", [JSON.stringify(await readSeed())]);
    }
  }

  async getState() {
    const result = await this.pool.query("SELECT data FROM app_state WHERE id = 1");
    return result.rows[0].data;
  }

  async setState(state) {
    await this.pool.query("UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(state)]);
  }

  async close() {
    await this.pool.end();
  }
}

export async function createStore() {
  const store = process.env.DATABASE_URL ? new PostgresStore(process.env.DATABASE_URL) : new FileStore();
  await store.init();
  return store;
}
