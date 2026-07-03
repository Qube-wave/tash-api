import { createHash } from 'node:crypto';

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeValue(
          (value as Record<string, unknown>)[key],
        );
        return accumulator;
      }, {});
  }

  return value;
}

export function hashIdempotencyRequest(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeValue(body)))
    .digest('hex');
}
