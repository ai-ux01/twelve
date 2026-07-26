import { Injectable } from '@nestjs/common';
import { NormalizedTick } from './interfaces';

@Injectable()
export class TickCache {
  private readonly latestTicks: Map<string, NormalizedTick> = new Map();

  set(token: string, tick: NormalizedTick): void {
    this.latestTicks.set(token, tick);
  }

  get(token: string): NormalizedTick | null {
    return this.latestTicks.get(token) ?? null;
  }

  remove(token: string): void {
    this.latestTicks.delete(token);
  }

  getAll(): Map<string, NormalizedTick> {
    return this.latestTicks;
  }

  clear(): void {
    this.latestTicks.clear();
  }
}
