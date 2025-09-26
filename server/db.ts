
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import Database from 'better-sqlite3';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";

let db: any;
let pool: Pool | undefined;

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL not set. Using SQLite fallback.");
  // Fallback to SQLite
  const sqlite = new Database('centerfruit.db');
  db = drizzleSQLite(sqlite, { schema });
} else {
  try {
    console.log("🔍 Attempting PostgreSQL connection...");
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000, // 5 second timeout
    });
    db = drizzle(pool, { schema });
    console.log("✅ PostgreSQL connection established");
  } catch (error) {
    console.error("❌ PostgreSQL connection failed, falling back to SQLite:", error);
    // Fallback to SQLite
    const sqlite = new Database('centerfruit.db');
    db = drizzleSQLite(sqlite, { schema });
  }
}

export { db, pool };
