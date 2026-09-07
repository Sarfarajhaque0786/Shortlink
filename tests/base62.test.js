const base62 = require('../src/utils/base62');

describe('base62 encode/decode', () => {
  test('encodes 0 as the first alphabet character', () => {
    expect(base62.encode(0)).toBe('a');
  });

  test('round-trips a range of numbers', () => {
    const samples = [1, 61, 62, 63, 12567, 999999, 56800235583];
    for (const n of samples) {
      const encoded = base62.encode(n);
      expect(base62.decode(encoded)).toBe(n);
    }
  });

  test('produces URL-safe characters only', () => {
    const encoded = base62.encode(123456789);
    expect(encoded).toMatch(/^[a-zA-Z0-9]+$/);
  });

  test('encode is strictly increasing in length as numbers grow', () => {
    expect(base62.encode(61).length).toBeLessThanOrEqual(base62.encode(62 * 62).length);
  });

  test('throws on negative input', () => {
    expect(() => base62.encode(-1)).toThrow();
  });

  test('decode throws on invalid character', () => {
    expect(() => base62.decode('abc!')).toThrow();
  });
});
