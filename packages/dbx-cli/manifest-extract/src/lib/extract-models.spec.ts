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
