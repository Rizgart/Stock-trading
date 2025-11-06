export class RateLimiter {
  private readonly queue: Array<{
    execute: () => Promise<void>;
  }> = [];

  private active = false;

  constructor(private readonly minIntervalMs: number = 250) {}

  schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            setTimeout(() => {
              this.active = false;
              void this.runNext();
            }, this.minIntervalMs);
          }
        }
      });
      void this.runNext();
    });
  }

  private async runNext(): Promise<void> {
    if (this.active) {
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      return;
    }
    this.active = true;
    await next.execute();
  }
}
