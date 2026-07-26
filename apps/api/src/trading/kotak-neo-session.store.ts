import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Session store for Kotak Neo broker sessions.
 * Persists to a JSON file so sessions survive server restarts.
 */

export interface KotakSession {
  sessionId: string;
  auth: string;
  sid: string;
  baseUrl: string;
  dataCenter?: string;
  greetingName?: string;
  createdAt: Date;
}

const SESSION_FILE = path.join(__dirname, '..', '..', '.kotak-sessions.json');

@Injectable()
export class KotakSessionStore {
  private readonly logger = new Logger(KotakSessionStore.name);
  private sessions = new Map<string, KotakSession>();

  constructor() {
    this.loadFromDisk();
  }

  create(auth: string, sid: string, baseUrl: string, extra?: Partial<KotakSession>): string {
    const sessionId = randomUUID();
    const session: KotakSession = {
      sessionId,
      auth,
      sid,
      baseUrl,
      dataCenter: extra?.dataCenter,
      greetingName: extra?.greetingName,
      createdAt: new Date(),
    };
    this.sessions.set(sessionId, session);
    this.saveToDisk();
    this.logger.log(`Session created: ${sessionId} (user: ${extra?.greetingName || 'unknown'})`);
    return sessionId;
  }

  get(sessionId: string): KotakSession | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.saveToDisk();
      this.logger.log(`Session deleted: ${sessionId}`);
    }
    return deleted;
  }

  hasActiveSession(): boolean {
    return this.sessions.size > 0;
  }

  getLatest(): KotakSession | undefined {
    let latest: KotakSession | undefined;
    for (const session of this.sessions.values()) {
      if (!latest || new Date(session.createdAt) > new Date(latest.createdAt)) {
        latest = session;
      }
    }
    return latest;
  }

  private saveToDisk(): void {
    try {
      const data = JSON.stringify(Array.from(this.sessions.entries()));
      fs.writeFileSync(SESSION_FILE, data, 'utf-8');
    } catch {
      // Silently fail — disk persistence is best-effort
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const data = fs.readFileSync(SESSION_FILE, 'utf-8');
        const entries: [string, KotakSession][] = JSON.parse(data);
        this.sessions = new Map(entries);
        this.logger.log(`Loaded ${this.sessions.size} session(s) from disk`);
      }
    } catch {
      // Silently fail — start fresh
    }
  }
}
