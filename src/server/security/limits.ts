/** A small non-blocking concurrency gate for HTTP mutations and event streams. */
export class ConcurrencyGate {
  private active = 0;

  constructor(readonly maximum: number) {}

  tryAcquire(): (() => void) | null {
    if (this.active >= this.maximum) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }

  get inUse(): number {
    return this.active;
  }
}

/** Serializes workflow mutations so an expected revision cannot change during a native call. */
export class AsyncLock {
  private tail: Promise<void> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(async () => {
      try {
        return await work();
      } finally {
        release();
      }
    });
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private operations = 0;

  constructor(
    readonly limitPerMinute: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    const windowMs = 60_000;
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    this.operations += 1;
    if (this.operations % 1_000 === 0 || this.windows.size > 10_000) this.prune(now);
    const allowed = window.count <= this.limitPerMinute;
    return {
      allowed,
      remaining: Math.max(0, this.limitPerMinute - window.count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

export function clientKey(headers: Headers, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return "local";
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
