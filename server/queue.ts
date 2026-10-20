/** Tiny in-process job queue with a concurrency limit. */
export class Queue {
  private running = 0;
  private waiting: (() => void)[] = [];
  constructor(private readonly concurrency: number) {}

  async run<T>(job: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running++;
    try {
      return await job();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }

  get pending() {
    return this.waiting.length;
  }
}

/** Transcoding, transcription and rendering all compete for CPU: one at a time. */
export const heavyQueue = new Queue(1);
/** Claude runs are mostly waiting on the network. */
export const claudeQueue = new Queue(2);
