import { describe, expect, it } from 'vitest';
import { extractModelsFromSource } from './extract-models';

const NOTIFICATION_SOURCE = `import { firestoreModelIdentity, snapshotConverterFunctions, firestoreSubObject, firestoreObjectArray, firestoreString, firestoreNumber, firestoreDate, optionalFirestoreString } from '@dereekb/firebase';

/**
 * Recipient embedded inside a NotificationBox entry.
 */
export interface NotificationRecipient {
  /**
   * Email address override.
   * @dbxModelVariable email
   */
  e?: string;
  /**
   * Display name.
   * @dbxModelVariable name
   */
  n?: string;
}

export const firestoreNotificationRecipient = firestoreSubObject<NotificationRecipient>({
  objectField: {
    fields: {
      e: optionalFirestoreString(),
      n: optionalFirestoreString()
    }
  }
});

/**
 * @dbxModel
 */
export interface NotificationBox {
  /**
   * Created at.
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Recipients on the box.
   * @dbxModelVariable recipients
   */
  r: NotificationRecipient[];
  /**
   * Inline embedded item.
   * @dbxModelVariable item
   */
  it: { name: string };
}

export const notificationBoxIdentity = firestoreModelIdentity('notificationBox', 'nb');

export const notificationBoxConverter = snapshotConverterFunctions<NotificationBox>({
  fields: {
    cat: firestoreDate(),
    r: firestoreObjectArray({ objectField: firestoreNotificationRecipient }),
    it: firestoreSubObject<{ name: string }>({
      objectField: {
        fields: {
          n: firestoreString({ default: '' })
        }
      }
    })
  }
});
`;

describe('extractModelsFromSource()', () => {
  const result = extractModelsFromSource({ name: 'notification.ts', text: NOTIFICATION_SOURCE });

  it('detects exported firestoreModelIdentity declarations', () => {
    expect(result.identities).toHaveLength(1);
    expect(result.identities[0]).toEqual({
      identityConst: 'notificationBoxIdentity',
      modelType: 'notificationBox',
      collectionPrefix: 'nb',
      parentIdentityConst: undefined
    });
  });

  it('captures @dbxModel interfaces with per-property @dbxModelVariable tags', () => {
    const box = result.interfaces.find((i) => i.name === 'NotificationBox');
    expect(box?.hasDbxModelTag).toBe(true);
    const cat = box?.props.find((p) => p.name === 'cat');
    expect(cat?.longName).toBe('createdAt');
    const r = box?.props.find((p) => p.name === 'r');
    expect(r?.longName).toBe('recipients');
  });

  it('captures sibling interfaces without @dbxModel for nested-converter resolution', () => {
    const recipient = result.interfaces.find((i) => i.name === 'NotificationRecipient');
    expect(recipient?.hasDbxModelTag).toBe(false);
    const e = recipient?.props.find((p) => p.name === 'e');
    expect(e?.longName).toBe('email');
  });

  it('captures top-level converters (snapshotConverterFunctions and firestoreSubObject) by name', () => {
    const names = result.converters.map((c) => c.converterConst);
    expect(names).toContain('notificationBoxConverter');
    expect(names).toContain('firestoreNotificationRecipient');
  });

  it('records nestedConverterRef when objectField is a converter const reference', () => {
    const box = result.converters.find((c) => c.converterConst === 'notificationBoxConverter');
    const r = box?.fields.find((f) => f.key === 'r');
    expect(r?.nestedConverterRef).toBe('firestoreNotificationRecipient');
    expect(r?.nestedIsArray).toBe(true);
    expect(r?.nestedConverterInline).toBeUndefined();
  });

  it('records nestedConverterInline when objectField is an inline literal', () => {
    const box = result.converters.find((c) => c.converterConst === 'notificationBoxConverter');
    const it = box?.fields.find((f) => f.key === 'it');
    expect(it?.nestedConverterInline).toBeDefined();
    expect(it?.nestedConverterInline?.factory).toBe('firestoreSubObject');
    expect(it?.nestedConverterInline?.fields.map((f) => f.key)).toEqual(['n']);
    expect(it?.nestedIsArray).toBe(false);
  });

  it('returns empty arrays for files with no model artifacts', () => {
    const empty = extractModelsFromSource({ name: 'helper.ts', text: 'export const x = 1;' });
    expect(empty.identities).toHaveLength(0);
    expect(empty.interfaces).toHaveLength(0);
    expect(empty.converters).toHaveLength(0);
  });

  describe('@dbxModelMcpToolNameSegment tag', () => {
    it('captures the first token as the tool-name segment', () => {
      const source = `
        /**
         * A worker.
         * @dbxModel
         * @dbxModelMcpToolNameSegment wk
         */
        export interface Worker { name: string; }
      `;
      const { interfaces } = extractModelsFromSource({ name: 'worker.ts', text: source });
      expect(interfaces.find((i) => i.name === 'Worker')?.mcpToolNameSegment).toBe('wk');
    });

    it('omits the segment when the tag is absent', () => {
      const source = `
        /** @dbxModel */
        export interface Worker { name: string; }
      `;
      const { interfaces } = extractModelsFromSource({ name: 'worker.ts', text: source });
      expect(interfaces.find((i) => i.name === 'Worker')).not.toHaveProperty('mcpToolNameSegment');
    });

    it('ignores an invalid (non-identifier) segment value', () => {
      const source = `
        /**
         * @dbxModel
         * @dbxModelMcpToolNameSegment 9bad-value
         */
        export interface Worker { name: string; }
      `;
      const { interfaces } = extractModelsFromSource({ name: 'worker.ts', text: source });
      expect(interfaces.find((i) => i.name === 'Worker')).not.toHaveProperty('mcpToolNameSegment');
    });
  });

  describe('firestoreField nested converter resolution', () => {
    const SOURCE = `import { firestoreModelIdentity, snapshotConverterFunctions, firestoreSubObject, firestoreObjectArray, firestoreNumber } from '@dereekb/firebase';

export interface TimesheetDay {
  h: number;
}

export const workerTimesheetDay = firestoreSubObject<TimesheetDay>({
  objectField: { fields: { h: firestoreNumber({ default: 0 }) } }
});

/** @dbxModel */
export interface WorkerTimesheet {
  days: TimesheetDay[];
  weeks: TimesheetDay[];
}

export const workerTimesheetIdentity = firestoreModelIdentity('workerTimesheet', 'wt');

export const workerTimesheetConverter = snapshotConverterFunctions<WorkerTimesheet>({
  fields: {
    days: firestoreObjectArray({ filterUnique: true, firestoreField: workerTimesheetDay }),
    weeks: firestoreObjectArray({ firestoreField: firestoreSubObject<TimesheetDay>({ objectField: { fields: { h: firestoreNumber({ default: 0 }) } } }) })
  }
});
`;

    const result = extractModelsFromSource({ name: 'timesheet.ts', text: SOURCE });
    const converter = result.converters.find((c) => c.converterConst === 'workerTimesheetConverter');

    it('resolves firestoreObjectArray({ firestoreField: <const> }) to a nestedConverterRef (even behind sibling props)', () => {
      const days = converter?.fields.find((f) => f.key === 'days');
      expect(days?.nestedConverterRef).toBe('workerTimesheetDay');
      expect(days?.nestedIsArray).toBe(true);
      expect(days?.nestedConverterInline).toBeUndefined();
    });

    it('resolves inline firestoreField: firestoreSubObject<T>({...}) to an inline converter carrying the outer array-ness', () => {
      const weeks = converter?.fields.find((f) => f.key === 'weeks');
      expect(weeks?.nestedConverterInline).toBeDefined();
      expect(weeks?.nestedConverterInline?.factory).toBe('firestoreSubObject');
      expect(weeks?.nestedConverterInline?.interfaceName).toBe('TimesheetDay');
      expect(weeks?.nestedConverterInline?.fields.map((f) => f.key)).toEqual(['h']);
      expect(weeks?.nestedIsArray).toBe(true);
      expect(weeks?.nestedConverterRef).toBeUndefined();
    });
  });

  describe('extends-name peeling for utility-type wrappers', () => {
    it('returns a bare extends identifier unchanged', () => {
      const source = `
        export interface Base { a: string; }
        export interface Child extends Base {}
      `;
      const { interfaces } = extractModelsFromSource({ name: 'x.ts', text: source });
      const child = interfaces.find((i) => i.name === 'Child');
      expect(child?.extendsNames).toEqual(['Base']);
    });

    it('peels Partial<Base> to Base', () => {
      const source = `
        export interface Base { a: string; }
        export interface Child extends Partial<Base> {}
      `;
      const { interfaces } = extractModelsFromSource({ name: 'x.ts', text: source });
      const child = interfaces.find((i) => i.name === 'Child');
      expect(child?.extendsNames).toEqual(['Base']);
    });

    it('peels nested Partial<MaybeMap<Omit<Base, "k">>> to Base', () => {
      const source = `
        export interface Base { a: string; b: string; }
        export interface Child extends Partial<MaybeMap<Omit<Base, 'b'>>> {}
      `;
      const { interfaces } = extractModelsFromSource({ name: 'x.ts', text: source });
      const child = interfaces.find((i) => i.name === 'Child');
      expect(child?.extendsNames).toEqual(['Base']);
    });

    it('peels Partial<MaybeMap<Omit<Base,…>>>, Pick<Base,…> to two Base entries', () => {
      const source = `
        export interface Base { a: string; b: string; c: string; }
        export interface Child extends
          Partial<MaybeMap<Omit<Base, 'a' | 'b'>>>,
          Pick<Base, 'a' | 'b'> {}
      `;
      const { interfaces } = extractModelsFromSource({ name: 'x.ts', text: source });
      const child = interfaces.find((i) => i.name === 'Child');
      expect(child?.extendsNames).toEqual(['Base', 'Base']);
    });

    it('leaves an unknown wrapper as the leftmost identifier', () => {
      const source = `
        export interface Base { a: string; }
        export interface Child extends UnknownWrapper<Base> {}
      `;
      const { interfaces } = extractModelsFromSource({ name: 'x.ts', text: source });
      const child = interfaces.find((i) => i.name === 'Child');
      expect(child?.extendsNames).toEqual(['UnknownWrapper']);
    });

    it('falls back to the wrapper name when its type argument is not a type reference', () => {
      const source = `
        export interface Child extends Partial<{ a: string }> {}
      `;
      const { interfaces } = extractModelsFromSource({ name: 'x.ts', text: source });
      const child = interfaces.find((i) => i.name === 'Child');
      expect(child?.extendsNames).toEqual(['Partial']);
    });
  });
});
