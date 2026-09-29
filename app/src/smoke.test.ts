import { describe, expect, it } from 'vitest';

// Proves Vitest runs and compiles TypeScript. Real logic tests start with T3.
describe('smoke test', () => {
  it('runs a TypeScript test', () => {
    const sum: number = 1 + 1;
    expect(sum).toBe(2);
  });
});
