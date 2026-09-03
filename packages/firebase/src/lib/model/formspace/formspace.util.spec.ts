import { describe, expect, it } from 'vitest';
import { MS_IN_DAY, MS_IN_HOUR } from '@dereekb/util';
import { type FormSpace, type FormSpaceFile, FormSpaceFileValidationState, FormSpaceProcessingState, FormSpaceState } from './formspace';
import { type FormSpaceTypeConfig } from './formspace.type';
import { assertFormSpaceUploadAllowed, expireFormSpaceTemplate, formSpaceFilesInSlot, formSpaceSlotMaxFiles, formSpaceSlotMinFiles, formSpaceSlotStatus, formSpaceStorageFileGroupId, formSpaceSubmitBlockers, formSpaceTemplate, isFormSpaceEditable, isFormSpaceFullyLocked, isFormSpaceReopenable, lockFormSpaceTemplate, reopenFormSpaceTemplate, requiredFormSpaceFileSlots, resolveFormSpaceExpiresAt, resolveFormSpaceLocksAt, submitFormSpaceTemplate } from './formspace.util';

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
    fi: 0,
    rc: 0,
    f: [],
    cat: now,
    uat: now,
    ...overrides
  };
}

/**
 * A type that opts into reopening, bounded all three ways at once — the case where the rolling window, the
 * absolute ceiling and the count cap can each be shown to bind independently.
 */
const reopenableConfig: FormSpaceTypeConfig = {
  formSpaceType: 'demo_reopenable',
  expiresIn: 7 * MS_IN_DAY,
  reopenableFor: 2 * MS_IN_HOUR,
  reopenableUntil: MS_IN_DAY,
  maxReopens: 3
};

/**
 * A space submitted at `now`, with the lock deadline a first submission at `now` would have produced.
 */
function submitted(overrides?: Partial<FormSpace>): FormSpace {
  return draft({
    t: 'demo_reopenable',
    s: FormSpaceState.SUBMITTED,
    ps: FormSpaceProcessingState.QUEUED_FOR_PROCESSING,
    sat: now,
    fsat: now,
    lat: new Date(now.getTime() + MS_IN_DAY),
    ...overrides
  });
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
    expect(template.fi).toBe(0);
    expect(template.u).toBe('user123');
    expect(template.o).toBe('pr/user123');
    expect(template.cat).toBe(now);
    expect(template.uat).toBe(now);
    expect(isFormSpaceEditable({ formSpace: template, now })).toBe(true);
  });
});

describe('submitFormSpaceTemplate()', () => {
  it('should lock the space, queue processing, and clear eat', () => {
    const template = submitFormSpaceTemplate({ formSpace: draft(), config, now });

    expect(template.s).toBe(FormSpaceState.SUBMITTED);
    expect(template.ps).toBe(FormSpaceProcessingState.QUEUED_FOR_PROCESSING);
    expect(template.sat).toBe(now);
    expect(template.eat).toBeNull();
  });

  it('should stamp fsat and the lock deadline on a first submission', () => {
    const template = submitFormSpaceTemplate({ formSpace: draft(), config: reopenableConfig, now });

    expect(template.fsat).toBe(now);
    expect(template.lat?.getTime()).toBe(now.getTime() + MS_IN_DAY);
  });

  it('should leave lat unwritten on a first submission of a type with no ceiling', () => {
    const template = submitFormSpaceTemplate({ formSpace: draft(), config: { formSpaceType: 'x', reopenableFor: MS_IN_HOUR }, now });

    expect(template.fsat).toBe(now);
    expect(template.lat).toBeNull();
  });

  it('should not touch fsat or lat on a resubmission, so a reopen round cannot walk the deadline forward', () => {
    const firstSubmittedAt = new Date(now.getTime() - MS_IN_DAY / 2);
    const resubmit = submitFormSpaceTemplate({ formSpace: draft({ fsat: firstSubmittedAt }), config: reopenableConfig, now });

    expect(resubmit.sat).toBe(now);
    expect('fsat' in resubmit).toBe(false);
    expect('lat' in resubmit).toBe(false);
  });
});

describe('resolveFormSpaceLocksAt()', () => {
  it('should offset the FIRST submission by the type reopenableUntil', () => {
    expect(resolveFormSpaceLocksAt({ config: reopenableConfig, firstSubmittedAt: now })?.getTime()).toBe(now.getTime() + MS_IN_DAY);
  });

  it('should return null when the type declares no ceiling, so lat is never written', () => {
    expect(resolveFormSpaceLocksAt({ config, firstSubmittedAt: now })).toBeNull();
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

describe('isFormSpaceReopenable()', () => {
  it('should be true for a space submitted inside both windows', () => {
    expect(isFormSpaceReopenable({ formSpace: submitted(), config: reopenableConfig, now })).toBe(true);
  });

  it('should be false when the type never opted in, which is every existing type', () => {
    expect(isFormSpaceReopenable({ formSpace: submitted(), config, now })).toBe(false);
  });

  it('should be false once the rolling window from this submission has passed', () => {
    const at = new Date(now.getTime() + 2 * MS_IN_HOUR + 1);
    expect(isFormSpaceReopenable({ formSpace: submitted(), config: reopenableConfig, now: at })).toBe(false);
  });

  it('should be false once lat has passed even though the rolling window is open', () => {
    // the shape of a RESUBMISSION: `sat` is recent, so `reopenableFor` alone would still allow a reopen,
    // and only the deadline anchored to the first submission stops the round repeating forever
    const resubmitted = submitted({ lat: new Date(now.getTime() - 1), rc: 1 });
    expect(isFormSpaceReopenable({ formSpace: resubmitted, config: reopenableConfig, now })).toBe(false);
  });

  it('should be false once maxReopens is spent', () => {
    expect(isFormSpaceReopenable({ formSpace: submitted({ rc: 3 }), config: reopenableConfig, now })).toBe(false);
    expect(isFormSpaceReopenable({ formSpace: submitted({ rc: 2 }), config: reopenableConfig, now })).toBe(true);
  });

  it('should be false for a draft, which has no submission to reopen', () => {
    expect(isFormSpaceReopenable({ formSpace: draft({ t: 'demo_reopenable' }), config: reopenableConfig, now })).toBe(false);
  });

  it('should be false for EXPIRED and ARCHIVED, which stay terminal', () => {
    expect(isFormSpaceReopenable({ formSpace: submitted({ s: FormSpaceState.EXPIRED }), config: reopenableConfig, now })).toBe(false);
    expect(isFormSpaceReopenable({ formSpace: submitted({ s: FormSpaceState.ARCHIVED }), config: reopenableConfig, now })).toBe(false);
  });

  it('should ignore ps, which the action refuses on separately and transiently', () => {
    expect(isFormSpaceReopenable({ formSpace: submitted({ ps: FormSpaceProcessingState.PROCESSING }), config: reopenableConfig, now })).toBe(true);
  });
});

describe('isFormSpaceFullyLocked()', () => {
  it('should be false for an editable draft', () => {
    expect(isFormSpaceFullyLocked({ formSpace: draft(), config, now })).toBe(false);
  });

  it('should be false for a submitted space still inside its reopen window', () => {
    expect(isFormSpaceFullyLocked({ formSpace: submitted(), config: reopenableConfig, now })).toBe(false);
  });

  it('should be true for a submitted space of a type that never opted in', () => {
    expect(isFormSpaceFullyLocked({ formSpace: submitted({ t: 'demo_example' }), config, now })).toBe(true);
  });

  it('should be true once the reopen window has closed', () => {
    const at = new Date(now.getTime() + 2 * MS_IN_DAY);
    expect(isFormSpaceFullyLocked({ formSpace: submitted(), config: reopenableConfig, now: at })).toBe(true);
  });

  it('should be true for an expired draft', () => {
    expect(isFormSpaceFullyLocked({ formSpace: draft({ eat: new Date(now.getTime() - 1) }), config, now })).toBe(true);
  });
});

describe('reopenFormSpaceTemplate()', () => {
  it('should return the space to an editable draft', () => {
    const formSpace = submitted({ cpat: now, pn: 'nb/box/nbn/task' });
    const template = reopenFormSpaceTemplate({ formSpace, config: reopenableConfig, uid: 'coach1', now });

    expect(template.s).toBe(FormSpaceState.DRAFT);
    expect(template.ps).toBe(FormSpaceProcessingState.INIT_OR_NONE);
    expect(template.sat).toBeNull();
    expect(template.cpat).toBeNull();
    expect(template.pn).toBeNull();
    expect(isFormSpaceEditable({ formSpace: { ...formSpace, ...template }, now })).toBe(true);
  });

  it('should record who reopened it, when, and how many times', () => {
    const template = reopenFormSpaceTemplate({ formSpace: submitted({ rc: 1 }), config: reopenableConfig, uid: 'coach1', now });

    expect(template.rc).toBe(2);
    expect(template.rat).toBe(now);
    expect(template.rby).toBe('coach1');
  });

  it('should not rewind uc, fi, or fsat', () => {
    const template = reopenFormSpaceTemplate({ formSpace: submitted(), config: reopenableConfig, now });

    expect('uc' in template).toBe(false);
    expect('fi' in template).toBe(false);
    expect('fsat' in template).toBe(false);
  });

  it('should cap the re-armed eat at the lock deadline', () => {
    // expiresIn is seven days and the ceiling is one, so the draft must not outlive the window it was
    // reopened inside
    const template = reopenFormSpaceTemplate({ formSpace: submitted(), config: reopenableConfig, now });

    expect(template.eat?.getTime()).toBe(now.getTime() + MS_IN_DAY);
  });

  it('should re-arm eat from expiresIn when that is the earlier of the two', () => {
    const shortLived: FormSpaceTypeConfig = { ...reopenableConfig, expiresIn: MS_IN_HOUR };
    const template = reopenFormSpaceTemplate({ formSpace: submitted(), config: shortLived, now });

    expect(template.eat?.getTime()).toBe(now.getTime() + MS_IN_HOUR);
  });

  it('should leave eat null when the type declares neither bound', () => {
    const template = reopenFormSpaceTemplate({ formSpace: submitted({ lat: null }), config: { formSpaceType: 'x', reopenableFor: MS_IN_HOUR }, now });

    expect(template.eat).toBeNull();
  });
});

describe('lockFormSpaceTemplate()', () => {
  it('should move only the lock deadline and its actor', () => {
    const template = lockFormSpaceTemplate({ uid: 'coach1', now });

    expect(template.lat).toBe(now);
    expect(template.lby).toBe('coach1');
    expect(template.uat).toBe(now);
    expect('s' in template).toBe(false);
    expect('ps' in template).toBe(false);
    expect('sat' in template).toBe(false);
  });

  it('should make a space that was reopenable fully locked', () => {
    const formSpace = { ...submitted(), ...lockFormSpaceTemplate({ now }) };
    expect(isFormSpaceReopenable({ formSpace, config: reopenableConfig, now: new Date(now.getTime() + 1) })).toBe(false);
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

    expect(assertFormSpaceUploadAllowed({ ...base, formSpace: full }).reason).toBe('slot_full');
  });

  it('should accept into a folder slot that still has room', () => {
    const base = { config: folderConfig, slot: 'documents', mimeType: 'application/pdf', sizeBytes: 512, now } as const;
    const partial = draft({ t: 'demo_folder', f: [file({ sf: 'a', n: 'a.pdf' })] });

    expect(assertFormSpaceUploadAllowed({ ...base, formSpace: partial }).allowed).toBe(true);
  });

  it('should accept a filename the slot already holds, since the name no longer keys the path', () => {
    const base = { config: folderConfig, slot: 'documents', mimeType: 'application/pdf', sizeBytes: 512, now } as const;
    const partial = draft({ t: 'demo_folder', f: [file({ sf: 'a', n: 'a.pdf' })] });

    expect(assertFormSpaceUploadAllowed({ ...base, formSpace: partial }).allowed).toBe(true);
  });

  it('should allow a one-file slot to be re-uploaded into, since it supersedes rather than fills', () => {
    const occupied = draft({ f: [file({ sl: 'resume', sf: 'a', n: 'old.pdf' })] });
    expect(assertFormSpaceUploadAllowed({ ...base, formSpace: occupied }).allowed).toBe(true);
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

describe('formSpaceSlotStatus()', () => {
  const resume = file({ sl: 'resume', sf: 'r', n: 'r.pdf', v: FormSpaceFileValidationState.NONE });

  it('should report a required slot with no file as neither satisfied nor complete', () => {
    const status = formSpaceSlotStatus({ formSpace: draft({ t: 'demo_folder' }), config: folderConfig, slot: 'resume' });

    expect(status.required).toBe(true);
    expect(status.minFiles).toBe(1);
    expect(status.files).toHaveLength(0);
    expect(status.blockers.map((x) => x.reason)).toEqual(['missing_files']);
    expect(status.satisfied).toBe(false);
    expect(status.complete).toBe(false);
  });

  it('should report a filled required slot as complete', () => {
    const status = formSpaceSlotStatus({ formSpace: draft({ t: 'demo_folder', f: [resume] }), config: folderConfig, slot: 'resume' });

    expect(status.satisfied).toBe(true);
    expect(status.complete).toBe(true);
  });

  // the distinction the checkmark hangs on: an untouched optional slot is holding up nothing, but the user
  // has not dealt with it either, so it must not be marked done
  it('should report an empty optional slot as satisfied but not complete', () => {
    const status = formSpaceSlotStatus({ formSpace: draft({ f: [] }), config, slot: 'attachment' });

    expect(status.required).toBe(false);
    expect(status.blockers).toEqual([]);
    expect(status.satisfied).toBe(true);
    expect(status.complete).toBe(false);
  });

  it('should report a filled optional slot as complete', () => {
    const status = formSpaceSlotStatus({ formSpace: draft({ f: [file({ sl: 'attachment', sf: 'a', n: 'a.png' })] }), config, slot: 'attachment' });

    expect(status.satisfied).toBe(true);
    expect(status.complete).toBe(true);
  });

  it('should report a folder slot below its minFiles as incomplete despite holding a file', () => {
    const status = formSpaceSlotStatus({ formSpace: draft({ t: 'demo_folder', f: [resume, file({ sf: 'a', n: 'a.pdf' })] }), config: folderConfig, slot: 'documents' });

    expect(status.minFiles).toBe(2);
    expect(status.maxFiles).toBe(3);
    expect(status.files).toHaveLength(1);
    expect(status.blockers.map((x) => x.reason)).toEqual(['missing_files']);
    expect(status.complete).toBe(false);
  });

  it('should report a rejected file as incomplete even though the slot holds enough', () => {
    const invalid = file({ sf: 'b', n: 'b.pdf', v: FormSpaceFileValidationState.INVALID, r: 'not a pdf' });
    const status = formSpaceSlotStatus({ formSpace: draft({ t: 'demo_folder', f: [resume, file({ sf: 'a', n: 'a.pdf' }), invalid] }), config: folderConfig, slot: 'documents' });

    expect(status.files).toHaveLength(2);
    expect(status.blockers.map((x) => x.reason)).toEqual(['invalid_file']);
    expect(status.satisfied).toBe(false);
    expect(status.complete).toBe(false);
  });

  // one slot's problem is not another's — the section rendering `resume` must not inherit `documents`' blocker
  it('should report only the blockers of the slot asked about', () => {
    const status = formSpaceSlotStatus({ formSpace: draft({ t: 'demo_folder', f: [resume] }), config: folderConfig, slot: 'resume' });

    expect(status.blockers).toEqual([]);
    expect(status.complete).toBe(true);
  });

  it('should fall back to the slot defaults for an undeclared slot', () => {
    const status = formSpaceSlotStatus({ formSpace: draft({ f: [] }), config, slot: 'unknown' });

    expect(status.minFiles).toBe(0);
    expect(status.maxFiles).toBe(1);
    expect(status.required).toBe(false);
    expect(status.satisfied).toBe(true);
    expect(status.complete).toBe(false);
  });
});
