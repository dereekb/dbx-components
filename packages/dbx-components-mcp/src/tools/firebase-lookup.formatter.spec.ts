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
