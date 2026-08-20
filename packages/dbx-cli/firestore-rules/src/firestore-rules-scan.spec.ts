import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { firestoreRulesAccessForCollection, scanFirestoreRules, serverOnlyCollections, type FirestoreRulesAccess } from './firestore-rules-scan.js';

const WORKSPACE_RULES = resolve(__dirname, '../../../../firestore.rules');

describe('scanFirestoreRules()', () => {
  describe('against the workspace firestore.rules', () => {
    const scan = scanFirestoreRules(readFileSync(WORKSPACE_RULES, 'utf8'));

    /**
     * The full expected classification. This table is the contract: it is what the model API's
     * server-only gate is derived from, and it is cross-checked by
     * `apps/demo-api/src/test/tests/firestore.rules.spec.ts`, which drives the real rules engine.
     */
    const expected: Readonly<Record<string, readonly [FirestoreRulesAccess, FirestoreRulesAccess]>> = {
      gb: ['allowed', 'allowed'],
      gbe: ['allowed', 'allowed'],
      pr: ['allowed', 'allowed'],
      nu: ['allowed', 'allowed'],
      ns: ['allowed', 'allowed'],
      nb: ['allowed', 'allowed'],
      oidc_e: ['allowed', 'allowed'],
      // gettable by id, deliberately NOT listable
      uec: ['allowed', 'denied'],
      sf: ['allowed', 'unmatched'],
      sfg: ['allowed', 'unmatched'],
      // written-down refusals
      nbn: ['denied', 'denied'],
      nbnw: ['denied', 'denied']
    };

    for (const [collection, [get, list]] of Object.entries(expected)) {
      it(`classifies ${collection} as get=${get} list=${list}`, () => {
        const entry = firestoreRulesAccessForCollection(scan, collection);
        expect(entry.get).toBe(get);
        expect(entry.list).toBe(list);
      });
    }

    // every model the rules file has NO match block for at all
    for (const collection of ['sys', 'sysp', 'orp', 'orpv', 'orrt', 'pp', 'uecp']) {
      it(`reports ${collection} as unmatched and server-only`, () => {
        const entry = firestoreRulesAccessForCollection(scan, collection);
        expect(entry.get).toBe('unmatched');
        expect(entry.list).toBe('unmatched');
        expect(entry.serverOnly).toBe(true);
        expect(entry.paths).toEqual([]);
      });
    }

    it('marks gbe as reachable as a collection group', () => {
      const entry = firestoreRulesAccessForCollection(scan, 'gbe');
      expect(entry.collectionGroup).toBe(true);
      expect(entry.paths).toEqual(['/gb/{guestbook}/gbe/{guestbookEntry}', '/{path=**}/gbe/{guestbookEntry}']);
    });

    it('does not mark a plain nested collection as a group', () => {
      expect(firestoreRulesAccessForCollection(scan, 'nbn').collectionGroup).toBe(false);
    });

    it('reports exactly the two written-down server-only collections', () => {
      expect(serverOnlyCollections(scan)).toEqual(['nbn', 'nbnw']);
    });

    it('resolves nested match paths through their parent', () => {
      expect(firestoreRulesAccessForCollection(scan, 'nbn').paths).toEqual(['/nb/{notificationBox}/nbn/{notification}']);
    });
  });

  describe('grammar handling', () => {
    it('treats `allow read` as covering both get and list', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            match /x/{doc} { allow read: if true; }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'x')).toMatchObject({ get: 'allowed', list: 'allowed', serverOnly: false });
    });

    it('treats a constant-false condition as denied, not allowed', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            match /x/{doc} { allow read: if false; }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'x')).toMatchObject({ get: 'denied', list: 'denied', serverOnly: true });
    });

    it('lets one non-false grant win over a sibling constant-false grant', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            match /x/{doc} {
              allow get: if false;
              allow get: if request.auth != null;
            }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'x').get).toBe('allowed');
    });

    it('splits a comma-separated op list', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            match /x/{doc} { allow list, write: if true; }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'x')).toMatchObject({ get: 'unmatched', list: 'allowed', serverOnly: false });
    });

    it('ignores write-only grants when deciding server-only', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            match /x/{doc} { allow write: if true; }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'x').serverOnly).toBe(true);
    });

    it('does not read `allow` statements out of a helper function body', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            function isAllowed() {
              return request.auth != null;
            }
            match /x/{doc} { allow get: if isAllowed(); }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'x').get).toBe('allowed');
    });

    it('ignores a `//` sequence inside a string literal', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            match /x/{doc} { allow get: if resource.data.o == 'https://example.com'; allow list: if false; }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'x')).toMatchObject({ get: 'allowed', list: 'denied' });
    });

    it('strips block comments', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            /* match /commented/{doc} { allow read: if true; } */
            match /x/{doc} { allow get: if true; }
          }
        }
      `);
      expect(scan.collections.map((c) => c.collection)).toEqual(['x']);
    });

    it('resolves a literal document id path to its collection', () => {
      const scan = scanFirestoreRules(`
        service cloud.firestore {
          match /databases/{database}/documents {
            match /sys/myfeatureflags { allow get: if true; }
          }
        }
      `);
      expect(firestoreRulesAccessForCollection(scan, 'sys').get).toBe('allowed');
    });

    it('returns an unmatched, server-only entry for a collection the file never names', () => {
      const scan = scanFirestoreRules('service cloud.firestore { match /databases/{database}/documents { } }');
      expect(firestoreRulesAccessForCollection(scan, 'nope')).toEqual({ collection: 'nope', paths: [], get: 'unmatched', list: 'unmatched', collectionGroup: false, serverOnly: true });
    });
  });
});
