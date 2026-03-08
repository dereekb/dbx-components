import { type LabeledValue, labeledValueMap } from './label';

describe('labeledValueMap()', () => {
  it('should create a map keyed by value from an array of labeled values', () => {
    const items: LabeledValue<string>[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' }
    ];
    const map = labeledValueMap(items);

    expect(map.get('a')?.label).toBe('Alpha');
    expect(map.get('b')?.label).toBe('Beta');
    expect(map.size).toBe(2);
  });

  it('should handle an empty array', () => {
    const map = labeledValueMap([]);
    expect(map.size).toBe(0);
  });

  it('should handle numeric value keys', () => {
    const items: LabeledValue<number>[] = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' }
    ];
    const map = labeledValueMap(items);

    expect(map.get(1)?.label).toBe('One');
    expect(map.get(2)?.label).toBe('Two');
  });

  it('should use the last entry when duplicate values exist', () => {
    const items: LabeledValue<string>[] = [
      { value: 'a', label: 'First' },
      { value: 'a', label: 'Second' }
    ];
    const map = labeledValueMap(items);

    expect(map.get('a')?.label).toBe('Second');
    expect(map.size).toBe(1);
  });
});
