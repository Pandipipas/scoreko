import { setTimeout } from 'node:timers/promises';

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      
      const firstValidIdx = this.timestamps.findIndex((t) => now - t < this.windowMs);
      if (firstValidIdx > 0) {
        this.timestamps.splice(0, firstValidIdx);
      } else if (firstValidIdx === -1 && this.timestamps.length > 0) {
        this.timestamps = [];
      }

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      
      const oldest = this.timestamps[0];
      if (oldest) {
        const timeToWait = this.windowMs - (now - oldest) + 10; 
        await setTimeout(Math.max(timeToWait, 10));
      } else {
        await setTimeout(100);
      }
    }
  }
}
