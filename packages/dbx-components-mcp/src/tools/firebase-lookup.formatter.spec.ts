import { describe, expect, it } from 'vitest';
import type { FirebaseModel } from '../registry/firebase-models.js';
import { formatFirebaseModelEntry } from './firebase-lookup.formatter.js';

const BASE_MODEL: FirebaseModel = {
  name: 'TestModel',
  identityConst: 'testModelIdentity',
  modelType: 'testModel',
  collectionPrefix: 'tm',
  sourcePackage: '@dereekb/firebase',
  sourceFile: 'packages/firebase/src/lib/model/test/test.ts',
  fields: [
    {
      name: 'x',
      longName: 'value',
      converter: 'firestoreString()',
      tsType: 'string',
      optional: false
    }
  ],
  enums: [],
  detectionHints: ['x'],
  collectionKind: 'root'
};

describe('formatFirebaseModelEntry user-keying line', () => {
  it('omits the User keying line when neither flag is set', () => {
    const output = formatFirebaseModelEntry(BASE_MODEL, 'brief');
    expect(output).not.toContain('**User keying:**');
  });

  it('renders the userKeyedById-only line', () => {
    const model: FirebaseModel = { ...BASE_MODEL, userKeyedById: true };
    const output = formatFirebaseModelEntry(model, 'brief');
    expect(output).toContain('**User keying:** doc id is the Firebase Auth uid (`UserRelatedById`)');
    expect(output).not.toContain('also carries an explicit');
  });

  it('renders the hasUserUidField-only line', () => {
    const model: FirebaseModel = { ...BASE_MODEL, hasUserUidField: true };
    const output = formatFirebaseModelEntry(model, 'brief');
    expect(output).toContain('**User keying:** carries an explicit `uid` field referencing the Firebase Auth user (`UserRelated`)');
  });

  it('renders the combined line when both flags are set', () => {
    const model: FirebaseModel = { ...BASE_MODEL, userKeyedById: true, hasUserUidField: true };
    const output = formatFirebaseModelEntry(model, 'full');
    expect(output).toContain('**User keying:** doc id is the Firebase Auth uid (`UserRelatedById`) · also carries an explicit `uid` field (`UserRelated`)');
  });
});

describe('formatFirebaseModelEntry sub-object rendering', () => {
  const SUB_OBJECT_MODEL: FirebaseModel = {
    ...BASE_MODEL,
    fields: [
      {
        name: 'bg',
        longName: 'embeddedBillingGroups',
        converter: 'firestoreObjectArray<BillingGroupRegionEmbeddedBillingGroup>(...)',
        tsType: 'BillingGroupRegionEmbeddedBillingGroup[]',
        optional: false,
        description: 'Embedded billing groups for this region.',
        subObject: {
          interfaceName: 'BillingGroupRegionEmbeddedBillingGroup',
          factoryKind: 'array',
          fields: [
            {
              name: 'bg',
              longName: 'billingGroupId',
              converter: '',
              tsType: 'BillingGroupId',
              optional: false,
              description: 'Reference to the billing group.'
            },
            {
              name: 'n',
              longName: 'name',
              converter: '',
              tsType: 'string',
              optional: false
            }
          ]
        }
      }
    ]
  };

  it('renders the parent field with its long-name folded into the Field column', () => {
    const output = formatFirebaseModelEntry(SUB_OBJECT_MODEL, 'full');
    expect(output).toContain('`bg (embeddedBillingGroups)`');
  });

  it('emits a Sub-object section listing the embedded fields with their long names', () => {
    const output = formatFirebaseModelEntry(SUB_OBJECT_MODEL, 'full');
    expect(output).toContain('### Sub-object: `bg (embeddedBillingGroups)` → `BillingGroupRegionEmbeddedBillingGroup` (embedded array)');
    expect(output).toContain('| `bg (billingGroupId)` | Reference to the billing group. | `BillingGroupId` |');
    expect(output).toContain('| `n (name)` | – | `string` |');
  });

  it('accepts a sub-object long-name in the fields filter, keeping the parent field', () => {
    const output = formatFirebaseModelEntry(SUB_OBJECT_MODEL, 'full', { fields: ['billinggroupid'] });
    expect(output).toContain('## Fields (1 of 1)');
    expect(output).toContain('`bg (embeddedBillingGroups)`');
    expect(output).not.toContain('_Unmatched filters');
  });

  it('reports a filter token as unmatched when neither the parent nor its sub-object fields match', () => {
    // Caller is responsible for lowercasing entries (the tool wrapper does this);
    // we mirror that contract here so the formatter sees the same shape.
    const output = formatFirebaseModelEntry(SUB_OBJECT_MODEL, 'full', { fields: ['notarealfield'] });
    expect(output).toContain('_Unmatched filters: `notarealfield`._');
    expect(output).toContain('_No fields matched. Drop `fields` to see the full model._');
  });
});
