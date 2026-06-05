import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseModelSizeProfile } from './model-size.profile';
import { resolveConverter } from './model-size.resolve';
import { runModelSize } from './model-size.run';
import { generateSampleModel } from './model-size.sample';

const scratchSource = fileURLToPath(new URL('../scratch/example.scratch.ts', import.meta.url));

describe('model-size integration (real scratch converter)', () => {
  it('resolves + imports the converter and reflects the stored (converted) shape', async () => {
    const profile = parseModelSizeProfile({
      source: scratchSource,
      export: 'exampleScratchConverter',
      defaults: { string: 10, number: 1000, arrayCount: 2, mapCount: 2 },
      fields: { 'entries[]': 5, 'entries[].m': 50 }
    });

    const resolved = await resolveConverter({ profile });
    expect(resolved.exportName).toBe('exampleScratchConverter');

    const { model } = generateSampleModel({ converter: resolved.converterTree, profile, registry: resolved.registry });
    const stored = resolved.converter.to(model) as Record<string, unknown>;
    const entries = stored['entries'] as Array<Record<string, unknown>>;

    // The "to" conversion changes the stored type: a Date model value is stored as an ISO string.
    expect(typeof stored['createdAt']).toBe('string');
    expect(entries).toHaveLength(5);
    expect(typeof entries[0]['at']).toBe('string');
  });

  it('runs the report and solves for the max entries count', async () => {
    const profile = parseModelSizeProfile({
      source: scratchSource,
      export: 'exampleScratchConverter',
      defaults: { string: 10, number: 1000, arrayCount: 2, mapCount: 2 },
      fields: { 'entries[]': 5, 'entries[].m': 50 },
      solveFor: 'entries[]'
    });

    const resolved = await resolveConverter({ profile });
    const report = runModelSize({ resolved, profile });

    expect(report.bytes).toBeGreaterThan(0);
    expect(report.withinLimit).toBe(true);

    const solve = report.solve;
    expect(solve).toBeDefined();

    if (solve) {
      expect(solve.maxCount).toBeGreaterThan(0);
      expect(solve.bytesAtMax).toBeLessThanOrEqual(solve.limitBytes);

      if (!solve.cappedAtProbeLimit) {
        expect(solve.bytesAtNext).toBeGreaterThan(solve.limitBytes);
      }
    }
  });

  it('merges a partial theoretical sample over the generated model', async () => {
    const base = parseModelSizeProfile({
      source: scratchSource,
      export: 'exampleScratchConverter',
      defaults: { string: 5, number: 1, arrayCount: 1, mapCount: 1 }
    });

    const resolved = await resolveConverter({ profile: base });
    const withoutOverride = runModelSize({ resolved, profile: base });
    const withOverride = runModelSize({ resolved, profile: { ...base, sample: { name: 'a-much-longer-overridden-name-value' } } });

    const nameBytesBefore = withoutOverride.breakdown.find((entry) => entry.key === 'name')?.bytes ?? 0;
    const nameBytesAfter = withOverride.breakdown.find((entry) => entry.key === 'name')?.bytes ?? 0;

    // The provided `name` wins over the generated value...
    expect(nameBytesAfter).toBeGreaterThan(nameBytesBefore);
    // ...while unspecified fields are still auto-filled.
    expect(withOverride.breakdown.some((entry) => entry.key === 'createdAt')).toBe(true);
  });
});
