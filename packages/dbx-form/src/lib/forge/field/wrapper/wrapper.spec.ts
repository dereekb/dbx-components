import { describe, it, expect } from 'vitest';
import { forgeRow, forgeSectionGroup, forgeSubsectionGroup } from './wrapper';

describe('forgeRow()', () => {
  it('should create a row field with correct type', () => {
    const row = forgeRow({ fields: [] });
    expect(row.type).toBe('row');
  });

  it('should set key to _row', () => {
    const row = forgeRow({ fields: [] });
    expect(row.key).toBe('_row');
  });

  it('should include the provided fields', () => {
    const fields = [
      { key: 'first', type: 'input' as const, label: 'First', col: 6 },
      { key: 'last', type: 'input' as const, label: 'Last', col: 6 }
    ];
    const row = forgeRow({ fields });
    expect(row.fields).toBe(fields);
  });

  it('should set className when provided', () => {
    const row = forgeRow({ fields: [], className: 'my-row' });
    expect((row as unknown as Record<string, unknown>).className).toBe('my-row');
  });

  it('should not set className when not provided', () => {
    const row = forgeRow({ fields: [] });
    expect((row as unknown as Record<string, unknown>).className).toBeUndefined();
  });
});

describe('forgeSectionGroup()', () => {
  it('should create a group field with correct type', () => {
    const group = forgeSectionGroup({ fields: [] });
    expect(group.type).toBe('group');
  });

  it('should default key to _section when not specified', () => {
    const group = forgeSectionGroup({ fields: [] });
    expect(group.key).toBe('_section');
  });

  it('should use provided key', () => {
    const group = forgeSectionGroup({ key: 'address', fields: [] });
    expect(group.key).toBe('address');
  });

  it('should include the provided fields', () => {
    const fields = [
      { key: 'street', type: 'input' as const, label: 'Street' },
      { key: 'city', type: 'input' as const, label: 'City' }
    ];
    const group = forgeSectionGroup({ fields });
    expect(group.fields).toBe(fields);
  });

  it('should set className when provided', () => {
    const group = forgeSectionGroup({ fields: [], className: 'my-section' });
    expect((group as unknown as Record<string, unknown>).className).toBe('my-section');
  });

  it('should not set className when not provided', () => {
    const group = forgeSectionGroup({ fields: [] });
    expect((group as unknown as Record<string, unknown>).className).toBeUndefined();
  });
});

describe('forgeSubsectionGroup()', () => {
  it('should create a group field with correct type', () => {
    const group = forgeSubsectionGroup({ fields: [] });
    expect(group.type).toBe('group');
  });

  it('should default key to _subsection when not specified', () => {
    const group = forgeSubsectionGroup({ fields: [] });
    expect(group.key).toBe('_subsection');
  });

  it('should use provided key', () => {
    const group = forgeSubsectionGroup({ key: 'names', fields: [] });
    expect(group.key).toBe('names');
  });

  it('should include the provided fields', () => {
    const fields = [
      { key: 'firstName', type: 'input' as const, label: 'First Name' },
      { key: 'lastName', type: 'input' as const, label: 'Last Name' }
    ];
    const group = forgeSubsectionGroup({ fields });
    expect(group.fields).toBe(fields);
  });

  it('should set className when provided', () => {
    const group = forgeSubsectionGroup({ fields: [], className: 'my-subsection' });
    expect((group as unknown as Record<string, unknown>).className).toBe('my-subsection');
  });

  it('should not set className when not provided', () => {
    const group = forgeSubsectionGroup({ fields: [] });
    expect((group as unknown as Record<string, unknown>).className).toBeUndefined();
  });
});
