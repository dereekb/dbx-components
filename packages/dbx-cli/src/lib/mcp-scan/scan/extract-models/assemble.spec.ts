import { describe, expect, it } from 'vitest';
import { resolveSubObjectReference, type SubObjectConstEntry } from './assemble.js';

const INDEX = new Map<string, SubObjectConstEntry>([['workerTimesheetDay', { interfaceName: 'WorkerTimesheetDay', factoryKind: 'object' }]]);

describe('resolveSubObjectReference (firestoreField sub-object expansion)', () => {
  it('resolves firestoreObjectArray({ firestoreField: <const> }) behind sibling props to the const interface as an array', () => {
    const result = resolveSubObjectReference('firestoreObjectArray({ filterUnique: true, firestoreField: workerTimesheetDay })', INDEX);
    expect(result).toEqual({ interfaceName: 'WorkerTimesheetDay', factoryKind: 'array' });
  });

  it('still resolves the legacy objectField carrier', () => {
    const result = resolveSubObjectReference('firestoreObjectArray({ objectField: workerTimesheetDay })', INDEX);
    expect(result).toEqual({ interfaceName: 'WorkerTimesheetDay', factoryKind: 'array' });
  });

  it('resolves inline firestoreField: firestoreSubObject<T>({...}) to T as an array via the type arg', () => {
    const result = resolveSubObjectReference('firestoreObjectArray({ firestoreField: firestoreSubObject<WorkerTimesheetDay>({ objectField: { fields: { h: firestoreNumber() } } }) })', INDEX);
    expect(result).toEqual({ interfaceName: 'WorkerTimesheetDay', factoryKind: 'array' });
  });

  it('resolves a bare sub-object const reference using its own factory kind', () => {
    const result = resolveSubObjectReference('workerTimesheetDay', INDEX);
    expect(result).toEqual({ interfaceName: 'WorkerTimesheetDay', factoryKind: 'object' });
  });

  it('returns undefined for an unrelated converter', () => {
    expect(resolveSubObjectReference('firestoreString()', INDEX)).toBeUndefined();
  });

  it('returns undefined when firestoreField references an unknown const', () => {
    expect(resolveSubObjectReference('firestoreObjectArray({ firestoreField: notInIndex })', INDEX)).toBeUndefined();
  });
});
