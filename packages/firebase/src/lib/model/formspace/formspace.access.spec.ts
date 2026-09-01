import { describe, expect, it } from 'vitest';
import { type FormSpace, type FormSpaceFile, FormSpaceFileValidationState, FormSpaceProcessingState, FormSpaceState } from './formspace';
import { type FormSpaceTypeConfig } from './formspace.type';
import { formSpaceFileUploaderId, formSpaceKeyForStorageFile, formSpaceSlotFileAccess, isFormSpaceFileAccessibleByUser, isFormSpaceFileAccessibleWithAccess } from './formspace.access';
import { type StorageFile } from '../storagefile/storagefile';
import { storageFileGroupIdForModel } from '../storagefile/storagefile.id';
import { FORM_SPACE_PURPOSE } from './formspace.upload';

const now = new Date('2026-01-02T03:04:05.000Z');

const OWNER = 'owner_uid';
const SIGNER = 'signer_uid';
const STRANGER = 'stranger_uid';

/**
 * The default shape: nothing declares `fileAccess`, so every slot resolves to `'space'`.
 */
const spaceConfig: FormSpaceTypeConfig = {
  formSpaceType: 'demo_test',
  slots: [{ slot: 'cover' }, { slot: 'folder', maxFiles: 4 }]
};

/**
 * A type that narrows on the TYPE, so a slot inherits it.
 */
const uploaderConfig: FormSpaceTypeConfig = {
  formSpaceType: 'demo_guestbook',
  fileAccess: 'uploader',
  slots: [{ slot: 'photos', maxFiles: 20 }]
};

/**
 * A type whose narrowing lives on ONE slot, with a sibling that keeps the type-level answer.
 */
const mixedConfig: FormSpaceTypeConfig = {
  formSpaceType: 'demo_mixed',
  slots: [{ slot: 'banner' }, { slot: 'documents', fileAccess: 'uploader' }]
};

function formSpace(overrides?: Partial<FormSpace>): FormSpace {
  return {
    t: 'demo_guestbook',
    s: FormSpaceState.DRAFT,
    ps: FormSpaceProcessingState.INIT_OR_NONE,
    u: OWNER,
    uc: 0,
    fi: 0,
    f: [],
    cat: now,
    uat: now,
    ...overrides
  };
}

function file(overrides?: Partial<FormSpaceFile>): FormSpaceFile {
  return {
    sl: 'photos',
    sf: 'sf1',
    n: 'a.png',
    v: FormSpaceFileValidationState.NONE,
    at: now,
    ...overrides
  };
}

describe('formSpaceSlotFileAccess()', () => {
  it('should default to "space" when nothing declares a policy', () => {
    expect(formSpaceSlotFileAccess({ config: spaceConfig, slot: 'cover' })).toBe('space');
  });

  it('should inherit the type-level policy on a slot that does not narrow it', () => {
    expect(formSpaceSlotFileAccess({ config: uploaderConfig, slot: 'photos' })).toBe('uploader');
  });

  it('should let a slot narrow past the type', () => {
    expect(formSpaceSlotFileAccess({ config: mixedConfig, slot: 'documents' })).toBe('uploader');
    expect(formSpaceSlotFileAccess({ config: mixedConfig, slot: 'banner' })).toBe('space');
  });

  it('should fall back to the type-level policy for an undeclared slot', () => {
    // an undeclared slot has no config to read, so it must not silently land on the permissive default
    // when the TYPE has already said otherwise
    expect(formSpaceSlotFileAccess({ config: uploaderConfig, slot: 'not_a_slot' })).toBe('uploader');
  });

  it('should fall back to the type-level policy when no slot is known at all', () => {
    expect(formSpaceSlotFileAccess({ config: uploaderConfig, slot: undefined })).toBe('uploader');
  });
});

describe('formSpaceFileUploaderId()', () => {
  it('should return the entry uploader', () => {
    expect(formSpaceFileUploaderId({ formSpace: formSpace(), file: file({ ub: SIGNER }) })).toBe(SIGNER);
  });

  it('should fall back to the space user for an entry written before `ub` existed', () => {
    expect(formSpaceFileUploaderId({ formSpace: formSpace(), file: file({ ub: undefined }) })).toBe(OWNER);
  });
});

describe('isFormSpaceFileAccessibleWithAccess()', () => {
  it('should allow anyone under "space", including a caller with no uid', () => {
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'space', formSpace: formSpace(), file: file({ ub: SIGNER }), uid: STRANGER })).toBe(true);
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'space', formSpace: formSpace(), file: file({ ub: SIGNER }), uid: undefined })).toBe(true);
  });

  it('should allow only the uploader under "uploader"', () => {
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'uploader', formSpace: formSpace(), file: file({ ub: SIGNER }), uid: SIGNER })).toBe(true);
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'uploader', formSpace: formSpace(), file: file({ ub: SIGNER }), uid: STRANGER })).toBe(false);
  });

  it('should refuse the space owner a file they did not upload under "uploader"', () => {
    // the whole point of the shared shape: `u` is who the space is filed under, not a moderator of it
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'uploader', formSpace: formSpace(), file: file({ ub: SIGNER }), uid: OWNER })).toBe(false);
  });

  it('should refuse an unauthenticated caller under "uploader"', () => {
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'uploader', formSpace: formSpace(), file: file({ ub: SIGNER }), uid: undefined })).toBe(false);
  });

  it('should allow the space owner a legacy entry with no uploader under "uploader"', () => {
    // an entry from before `ub` existed could only have come from `u`, so the fallback must not lock the
    // owner out of their own single-user space when its type later narrows
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'uploader', formSpace: formSpace(), file: file({ ub: undefined }), uid: OWNER })).toBe(true);
    expect(isFormSpaceFileAccessibleWithAccess({ fileAccess: 'uploader', formSpace: formSpace(), file: file({ ub: undefined }), uid: SIGNER })).toBe(false);
  });
});

describe('isFormSpaceFileAccessibleByUser()', () => {
  it('should resolve the policy from the slot the file is in', () => {
    const banner = file({ sl: 'banner', ub: SIGNER });
    const document = file({ sl: 'documents', ub: SIGNER });

    expect(isFormSpaceFileAccessibleByUser({ formSpace: formSpace(), config: mixedConfig, file: banner, uid: STRANGER })).toBe(true);
    expect(isFormSpaceFileAccessibleByUser({ formSpace: formSpace(), config: mixedConfig, file: document, uid: STRANGER })).toBe(false);
    expect(isFormSpaceFileAccessibleByUser({ formSpace: formSpace(), config: mixedConfig, file: document, uid: SIGNER })).toBe(true);
  });

  it('should allow every file of a type that declares no policy', () => {
    expect(isFormSpaceFileAccessibleByUser({ formSpace: formSpace(), config: spaceConfig, file: file({ sl: 'cover', ub: SIGNER }), uid: STRANGER })).toBe(true);
  });
});

describe('formSpaceKeyForStorageFile()', () => {
  const formSpaceKey = 'fsp/abc123';

  function storageFile(overrides?: Partial<StorageFile>): Pick<StorageFile, 'p' | 'g'> {
    return {
      p: FORM_SPACE_PURPOSE,
      g: [storageFileGroupIdForModel(formSpaceKey)],
      ...overrides
    } as Pick<StorageFile, 'p' | 'g'>;
  }

  it('should recover the FormSpace key from the group id', () => {
    expect(formSpaceKeyForStorageFile(storageFile())).toBe(formSpaceKey);
  });

  it('should recover a DERIVED id that contains the flat-key separator', () => {
    // `formSpaceIdForModel` produces `gb_<id>`, so the flattened group id is `fsp_gb_<id>`. Replacing every
    // `_` — which the generic `inferStorageFileGroupRelatedModelKey` does — yields the three-segment
    // `fsp/gb/<id>`, which is a collection path, not a document one.
    const derivedKey = 'fsp/gb_abc123';
    expect(formSpaceKeyForStorageFile(storageFile({ g: [storageFileGroupIdForModel(derivedKey)] }))).toBe(derivedKey);
  });

  it('should return null for a file of another purpose', () => {
    expect(formSpaceKeyForStorageFile(storageFile({ p: 'user_avatar' }))).toBeUndefined();
  });

  it('should ignore a group id that is not a FormSpace', () => {
    expect(formSpaceKeyForStorageFile(storageFile({ g: [storageFileGroupIdForModel('gb/xyz')] }))).toBeUndefined();
  });

  it('should find the FormSpace group among several', () => {
    expect(formSpaceKeyForStorageFile(storageFile({ g: [storageFileGroupIdForModel('gb/xyz'), storageFileGroupIdForModel(formSpaceKey)] }))).toBe(formSpaceKey);
  });
});
