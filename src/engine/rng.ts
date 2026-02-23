/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Deterministic: same seed always produces the same sequence.
 * Fast, simple, well-tested — no need for cryptographic quality.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) — like Math.random() but deterministic. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns true with the given probability (0–1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Returns the current internal state (for save/resume). */
  getState(): number {
    return this.state;
  }

  /** Restores internal state (for save/resume). */
  setState(state: number): void {
    this.state = state | 0;
  }
}
