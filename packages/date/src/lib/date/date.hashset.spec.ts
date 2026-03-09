import { DateSet } from './date.hashset';

describe('DateSet', () => {
  it('should store and retrieve dates by timestamp', () => {
    const date1 = new Date('2024-01-01T00:00:00Z');
    const date2 = new Date('2024-01-02T00:00:00Z');
    const set = new DateSet([date1, date2]);

    expect(set.has(new Date('2024-01-01T00:00:00Z'))).toBe(true);
    expect(set.has(new Date('2024-01-03T00:00:00Z'))).toBe(false);
  });

  it('should deduplicate dates with the same timestamp', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const set = new DateSet([date, new Date(date.getTime())]);

    expect(set.size).toBe(1);
  });

  it('should support adding and deleting dates', () => {
    const set = new DateSet();
    const date = new Date('2024-03-01T00:00:00Z');

    set.add(date);
    expect(set.has(date)).toBe(true);

    set.delete(date);
    expect(set.has(date)).toBe(false);
  });
});
