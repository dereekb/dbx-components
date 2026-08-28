import { describe, expect, it } from 'vitest';
import { MS_IN_DAY } from '@dereekb/util';
import { type FormSpace, type FormSpaceFile, FormSpaceFileValidationState, FormSpaceProcessingState, FormSpaceState } from './formspace';
import { type FormSpaceTypeConfig } from './formspace.type';
import { assertFormSpaceUploadAllowed, expireFormSpaceTemplate, formSpaceFilesInSlot, formSpaceSlotMaxFiles, formSpaceSlotMinFiles, formSpaceStorageFileGroupId, formSpaceSubmitBlockers, formSpaceTemplate, isFormSpaceEditable, requiredFormSpaceFileSlots, resolveFormSpaceExpiresAt, submitFormSpaceTemplate } from './formspace.util';

const now = new Date('2026-01-02T03:04:05.000Z');

const config: FormSpaceTypeConfig = {
  formSpaceType: 'demo_example',
  slots: [
    { slot: 'resume', required: true, allowedMimeTypes: ['application/pdf'], maxFileSizeBytes: 1024 },
    { slot: 'attachment', allowedMimeTypes: ['image/png'] }
  ],
  maxUploads: 2,
  expiresIn: 7 * MS_IN_DAY
};

/**
 * A type with a folder slot that validates what it accepts, for the cases `config` cannot express.
 */
const folderConfig: FormSpaceTypeConfig = {
  formSpaceType: 'demo_folder',
  slots: [
    { slot: 'resume', required: true, allowedMimeTypes: ['application/pdf'] },
    { slot: 'documents', maxFiles: 3, minFiles: 2, validationRequired: true, allowedMimeTypes: ['application/pdf'] }
  ],
  maxUploads: 20
};

function file(overrides?: Partial<FormSpaceFile>): FormSpaceFile {
  return {
    sl: 'documents',
    sf: 'sf1',
    n: 'a.pdf',
    v: FormSpaceFileValidationState.VALID,
    at: now,
    ...overrides
  };
}

function draft(overrides?: Partial<FormSpace>): FormSpace {
  return {
    t: 'demo_example',
    s: FormSpaceState.DRAFT,
    ps: FormSpaceProcessingState.INIT_OR_NONE,
    u: 'user123',
    uc: 0,
    f: [],
    cat: now,
    uat: now,
    ...overrides
  };
}

describe('formSpaceStorageFileGroupId()', () => {
  it('should flat-encode the FormSpace key', () => {
    expect(formSpaceStorageFileGroupId('fsp/abc123')).toBe('fsp_abc123');
  });
});

describe('resolveFormSpaceExpiresAt()', () => {
  it('should offset now by the type expiresIn', () => {
    expect(resolveFormSpaceExpiresAt({ config, now })?.getTime()).toBe(now.getTime() + 7 * MS_IN_DAY);
  });

  it('should return null when the type does not expire, so eat is never written', () => {
    expect(resolveFormSpaceExpiresAt({ config: { formSpaceType: 'x' }, now })).toBeNull();
  });
});

describe('formSpaceTemplate()', () => {
  it('should start as an editable draft with a zero upload counter', () => {
    const template = formSpaceTemplate({ formSpaceType: 'demo_example', uid: 'user123', ownerKey: 'pr/user123', now });

    expect(template.s).toBe(FormSpaceState.DRAFT);
    expect(template.ps).toBe(FormSpaceProcessingState.INIT_OR_NONE);
    expect(template.uc).toBe(0);
    expect(template.u).toBe('user123');
    expect(template.o).toBe('pr/user123');
    expect(template.cat).toBe(now);
    expect(template.uat).toBe(now);
    expect(isFormSpaceEditable({ formSpace: template, now })).toBe(true);
  });
});

describe('submitFormSpaceTemplate()', () => {
  it('should lock the space, queue processing, and clear eat', () => {
    const template = submitFormSpaceTemplate(now);

    expect(template.s).toBe(FormSpaceState.SUBMITTED);
    expect(template.ps).toBe(FormSpaceProcessingState.QUEUED_FOR_PROCESSING);
    expect(template.sat).toBe(now);
    expect(template.eat).toBeNull();
  });
});

describe('expireFormSpaceTemplate()', () => {
  it('should expire the space and clear eat so the sweep cannot re-expire it', () => {
    const template = expireFormSpaceTemplate(now);

    expect(template.s).toBe(FormSpaceState.EXPIRED);
    expect(template.ps).toBe(FormSpaceProcessingState.DO_NOT_PROCESS);
    expect(template.eat).toBeNull();
  });
});

describe('isFormSpaceEditable()', () => {
  it('should be true for a draft with no expiration', () => {
    expect(isFormSpaceEditable({ formSpace: draft(), now })).toBe(true);
  });

  it('should be true for a draft whose expiration has not arrived', () => {
    expect(isFormSpaceEditable({ formSpace: draft({ eat: new Date(now.getTime() + 1000) }), now })).toBe(true);
  });

  it('should be false once the expiration has passed, before any sweep has run', () => {
    expect(isFormSpaceEditable({ formSpace: draft({ eat: new Date(now.getTime() - 1000) }), now })).toBe(false);
  });

  it('should be false once submitted', () => {
    expect(isFormSpaceEditable({ formSpace: draft({ s: FormSpaceState.SUBMITTED, sat: now }), now })).toBe(false);
  });

  it('should be false for a stamped sat even if the state was not moved', () => {
    expect(isFormSpaceEditable({ formSpace: draft({ sat: now }), now })).toBe(false);
  });
});

describe('requiredFormSpaceFileSlots()', () => {
  it('should return only the required slots', () => {
    expect(requiredFormSpaceFileSlots(config)).toEqual(['resume']);
  });

  it('should return an empty array when the type declares no slots', () => {
    expect(requiredFormSpaceFileSlots({ formSpaceType: 'x' })).toEqual([]);
  });
});

describe('formSpaceSlotMaxFiles()', () => {
  it('should default an undeclared or unset slot to one file', () => {
    expect(formSpaceSlotMaxFiles(null)).toBe(1);
    expect(formSpaceSlotMaxFiles({ slot: 'resume' })).toBe(1);
  });

  it("should return the slot's own capacity", () => {
    expect(formSpaceSlotMaxFiles({ slot: 'documents', maxFiles: 3 })).toBe(3);
  });
});

describe('formSpaceSlotMinFiles()', () => {
  it('should default to zero, and to one when the slot is required', () => {
    expect(formSpaceSlotMinFiles({ slot: 'attachment' })).toBe(0);
    expect(formSpaceSlotMinFiles({ slot: 'resume', required: true })).toBe(1);
  });

  it('should let minFiles override required', () => {
    expect(formSpaceSlotMinFiles({ slot: 'documents', required: true, minFiles: 2 })).toBe(2);
  });
});

describe('formSpaceFilesInSlot()', () => {
  it('should return only the files in the named slot', () => {
    const formSpace = draft({ f: [file({ sf: 'a' }), file({ sf: 'b', sl: 'resume' }), file({ sf: 'c' })] });
    expect(formSpaceFilesInSlot(formSpace, 'documents').map((x) => x.sf)).toEqual(['a', 'c']);
  });
});

describe('assertFormSpaceUploadAllowed()', () => {
  const base = { config, slot: 'resume', mimeType: 'application/pdf', sizeBytes: 512, now } as const;

  it('should accept a conforming upload', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, formSpace: draft() })).toEqual({ allowed: true, reason: undefined });
  });

  it('should reject once the space is no longer editable', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, formSpace: draft({ sat: now }) }).reason).toBe('not_editable');
  });

  it('should reject an undeclared slot', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, slot: 'nope', formSpace: draft() }).reason).toBe('unknown_slot');
  });

  it('should accept an undeclared slot when the type opts in', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, slot: 'nope', config: { ...config, allowUndeclaredSlots: true }, formSpace: draft() }).allowed).toBe(true);
  });

  it('should reject once the monotonic upload counter reaches maxUploads', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, formSpace: draft({ uc: 2 }) }).reason).toBe('max_uploads_reached');
  });

  it('should reject once a folder slot is full', () => {
    const base = { config: folderConfig, slot: 'documents', mimeType: 'application/pdf', sizeBytes: 512, now } as const;
    const full = draft({ t: 'demo_folder', f: [file({ sf: 'a', n: 'a.pdf' }), file({ sf: 'b', n: 'b.pdf' }), file({ sf: 'c', n: 'c.pdf' })] });

    expect(assertFormSpaceUploadAllowed({ ...base, filename: 'd.pdf', formSpace: full }).reason).toBe('slot_full');
  });

  it('should accept into a folder slot that still has room', () => {
    const base = { config: folderConfig, slot: 'documents', mimeType: 'application/pdf', sizeBytes: 512, now } as const;
    const partial = draft({ t: 'demo_folder', f: [file({ sf: 'a', n: 'a.pdf' })] });

    expect(assertFormSpaceUploadAllowed({ ...base, filename: 'b.pdf', formSpace: partial }).allowed).toBe(true);
  });

  it('should reject a filename the slot already holds', () => {
    const base = { config: folderConfig, slot: 'documents', mimeType: 'application/pdf', sizeBytes: 512, now } as const;
    const partial = draft({ t: 'demo_folder', f: [file({ sf: 'a', n: 'a.pdf' })] });

    expect(assertFormSpaceUploadAllowed({ ...base, filename: 'a.pdf', formSpace: partial }).reason).toBe('duplicate_filename');
  });

  it('should still allow a one-file slot to be re-uploaded into, since it supersedes rather than fills', () => {
    const occupied = draft({ f: [file({ sl: 'resume', sf: 'a', n: 'old.pdf' })] });
    expect(assertFormSpaceUploadAllowed({ ...base, filename: 'new.pdf', formSpace: occupied }).allowed).toBe(true);
  });

  it('should reject a mime type the slot does not allow', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, mimeType: 'image/png', formSpace: draft() }).reason).toBe('invalid_mime_type');
  });

  it('should reject a file over the slot size cap', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, sizeBytes: 2048, formSpace: draft() }).reason).toBe('file_too_large');
  });

  it('should apply the slot rules over the type rules', () => {
    // the type would allow image/png, the resume slot narrows to application/pdf
    const widened: FormSpaceTypeConfig = { ...config, allowedMimeTypes: ['image/png'] };
    expect(assertFormSpaceUploadAllowed({ ...base, config: widened, mimeType: 'image/png', formSpace: draft() }).reason).toBe('invalid_mime_type');
  });

  it('should fall back to the type rules for a slot that does not narrow them', () => {
    expect(assertFormSpaceUploadAllowed({ ...base, slot: 'attachment', mimeType: 'image/png', sizeBytes: 1024 * 1024, formSpace: draft() }).allowed).toBe(true);
  });
});

describe('formSpaceSubmitBlockers()', () => {
  const twoValid = [file({ sf: 'a', n: 'a.pdf' }), file({ sf: 'b', n: 'b.pdf' })];
  const resume = file({ sl: 'resume', sf: 'r', n: 'r.pdf', v: FormSpaceFileValidationState.NONE });

  it('should report nothing when every slot is satisfied', () => {
    const formSpace = draft({ t: 'demo_folder', f: [resume, ...twoValid] });
    expect(formSpaceSubmitBlockers(formSpace, folderConfig)).toEqual([]);
  });

  it('should report a required slot with no file', () => {
    const formSpace = draft({ t: 'demo_folder', f: twoValid });
    expect(formSpaceSubmitBlockers(formSpace, folderConfig)).toEqual([{ slot: 'resume', reason: 'missing_files' }]);
  });

  it('should report a folder slot below its minFiles', () => {
    const formSpace = draft({ t: 'demo_folder', f: [resume, file({ sf: 'a', n: 'a.pdf' })] });
    expect(formSpaceSubmitBlockers(formSpace, folderConfig)).toEqual([{ slot: 'documents', reason: 'missing_files' }]);
  });

  it('should report an invalid file in a slot that requires validation', () => {
    const invalid = file({ sf: 'b', n: 'b.pdf', v: FormSpaceFileValidationState.INVALID, r: 'not a pdf' });
    const formSpace = draft({ t: 'demo_folder', f: [resume, file({ sf: 'a', n: 'a.pdf' }), invalid] });

    const blockers = formSpaceSubmitBlockers(formSpace, folderConfig);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].reason).toBe('invalid_file');
    expect(blockers[0].files?.map((x) => x.sf)).toEqual(['b']);
  });

  it('should report a pending file in a slot that requires validation', () => {
    const pending = file({ sf: 'b', n: 'b.pdf', v: FormSpaceFileValidationState.PENDING });
    const formSpace = draft({ t: 'demo_folder', f: [resume, file({ sf: 'a', n: 'a.pdf' }), pending] });

    const blockers = formSpaceSubmitBlockers(formSpace, folderConfig);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].reason).toBe('pending_validation');
  });

  it('should report the invalid file rather than the pending one when a slot holds both', () => {
    const invalid = file({ sf: 'b', n: 'b.pdf', v: FormSpaceFileValidationState.INVALID, r: 'not a pdf' });
    const pending = file({ sf: 'c', n: 'c.pdf', v: FormSpaceFileValidationState.PENDING });
    const formSpace = draft({ t: 'demo_folder', f: [resume, invalid, pending] });

    expect(formSpaceSubmitBlockers(formSpace, folderConfig).map((x) => x.reason)).toEqual(['invalid_file']);
  });

  it('should ignore validation state in a slot that does not require it', () => {
    const invalidResume = file({ sl: 'resume', sf: 'r', n: 'r.pdf', v: FormSpaceFileValidationState.INVALID });
    const formSpace = draft({ t: 'demo_folder', f: [invalidResume, ...twoValid] });

    expect(formSpaceSubmitBlockers(formSpace, folderConfig)).toEqual([]);
  });
});
