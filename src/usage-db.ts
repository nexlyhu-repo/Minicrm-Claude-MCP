import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.USAGE_DB_PATH || path.join(__dirname, "..", "data", "usage.db");

// Ensure data directory exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL,
    system_id TEXT NOT NULL,
    tool_name TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    success INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_usage_license ON usage_log(license_key);
  CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_log(timestamp);
`);

// Prepared statements
const insertLog = db.prepare(`
  INSERT INTO usage_log (license_key, system_id, tool_name, success)
  VALUES (?, ?, ?, ?)
`);

const getUsageByKey = db.prepare(`
  SELECT
    license_key,
    COUNT(*) as total_calls,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
    MAX(timestamp) as last_used
  FROM usage_log
  WHERE license_key = ?
  GROUP BY license_key
`);

const getAllUsage = db.prepare(`
  SELECT
    license_key,
    system_id,
    COUNT(*) as total_calls,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
    MAX(timestamp) as last_used
  FROM usage_log
  GROUP BY license_key
`);

const getRecentByKey = db.prepare(`
  SELECT tool_name, timestamp, success
  FROM usage_log
  WHERE license_key = ?
  ORDER BY timestamp DESC
  LIMIT ?
`);

const getToolBreakdown = db.prepare(`
  SELECT tool_name, COUNT(*) as count
  FROM usage_log
  WHERE license_key = ?
  GROUP BY tool_name
  ORDER BY count DESC
`);

export function logUsage(licenseKey: string, systemId: string, toolName: string | null, success: boolean): void {
  try {
    insertLog.run(licenseKey, systemId, toolName, success ? 1 : 0);
  } catch (err) {
    console.error("Usage log error:", err);
  }
}

export interface UsageStats {
  license_key: string;
  system_id?: string;
  total_calls: number;
  successful_calls: number;
  last_used: string | null;
}

export function getUsageStats(licenseKey: string): UsageStats | null {
  return getUsageByKey.get(licenseKey) as UsageStats | null;
}

export function getAllUsageStats(): UsageStats[] {
  return getAllUsage.all() as UsageStats[];
}

export function getRecentCalls(licenseKey: string, limit = 50): { tool_name: string; timestamp: string; success: number }[] {
  return getRecentByKey.all(licenseKey, limit) as any[];
}

export function getToolStats(licenseKey: string): { tool_name: string; count: number }[] {
  return getToolBreakdown.all(licenseKey) as any[];
}
