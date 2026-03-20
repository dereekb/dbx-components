import { lastValueFrom, from, toArray } from 'rxjs';
import { type FilterWithPreset } from './filter';
import { makeMapFilterWithPresetFn, mapFilterWithPreset } from './filter.preset';

interface TestFilter extends FilterWithPreset {
  active?: boolean;
  name?: string;
}

const testPresetMapFn = (f: TestFilter) => {
  if (f.preset === 'active') {
    return { active: true } as TestFilter;
  }

  return { active: false } as TestFilter;
};

describe('makeMapFilterWithPresetFn()', () => {
  it('should expand a preset into concrete filter values and remove the preset field', () => {
    const resolve = makeMapFilterWithPresetFn<TestFilter>(testPresetMapFn);
    const result = resolve({ preset: 'active' });

    expect(result.active).toBe(true);
    expect((result as TestFilter).preset).toBeUndefined();
  });

  it('should pass through filters without a preset unchanged', () => {
    const resolve = makeMapFilterWithPresetFn<TestFilter>(testPresetMapFn);
    const result = resolve({ active: true, name: 'test' });

    expect(result.active).toBe(true);
    expect(result.name).toBe('test');
  });
});

describe('mapFilterWithPreset()', () => {
  it('should resolve presets in a stream of filter values', async () => {
    const results = await lastValueFrom(from<TestFilter[]>([{ preset: 'active' }, { active: false, name: 'custom' }]).pipe(mapFilterWithPreset<TestFilter>(testPresetMapFn), toArray()));

    expect(results.length).toBe(2);
    expect(results[0].active).toBe(true);
    expect(results[1].active).toBe(false);
    expect(results[1].name).toBe('custom');
  });
});
