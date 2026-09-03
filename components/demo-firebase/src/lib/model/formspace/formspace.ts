import { type AppFormSpaceTypeConfigService, appFormSpaceTypeConfigService, type FirestoreModelKey, type FormSpaceData, type FormSpaceFileSlot, type FormSpaceId, formSpaceIdForModel, type FormSpaceType, type FormSpaceTypeConfig, formSpaceTypeConfigRecord } from '@dereekb/firebase';
import { MS_IN_DAY, MS_IN_HOUR } from '@dereekb/util';

/**
 * The {@link FormSpaceType} of the demo app's example form.
 */
export const DEMO_EXAMPLE_FORM_SPACE_TYPE: FormSpaceType = 'demo_example';

/**
 * The required resume slot of {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}.
 */
export const DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT: FormSpaceFileSlot = 'resume';

/**
 * The optional attachment slot of {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}.
 */
export const DEMO_EXAMPLE_FORM_SPACE_ATTACHMENT_SLOT: FormSpaceFileSlot = 'attachment';

/**
 * The FOLDER slot of {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}.
 *
 * Holds several files rather than one, and every file it accepts is validated. It is the demo's coverage of
 * both features the single-file `resume` / `attachment` slots cannot exercise.
 */
export const DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT: FormSpaceFileSlot = 'documents';

/**
 * How many files {@link DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT} holds.
 */
export const DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES = 3;

/**
 * The shape of the JSON a {@link DEMO_EXAMPLE_FORM_SPACE_TYPE} space parks in its `d` field.
 *
 * The framework never interprets `d` — this interface is the DEMO's contract with its own handler, which
 * is exactly how a downstream app narrows the generic at the point it reads the space.
 */
export interface DemoExampleFormSpaceData extends FormSpaceData {
  readonly fullName?: string;
  readonly message?: string;
}

// MARK: demo_test
/**
 * The {@link FormSpaceType} of the demo app's test form, the one `/demo/app/formspace` drives.
 *
 * Deliberately the SIMPLEST useful shape — one required single-file slot, one folder slot, and a JSON
 * payload — so the page exercises every part of the lifecycle without also inheriting
 * {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}'s validation, which has its own coverage.
 */
export const DEMO_TEST_FORM_SPACE_TYPE: FormSpaceType = 'demo_test';

/**
 * The single-file slot of {@link DEMO_TEST_FORM_SPACE_TYPE}.
 *
 * A POSITION rather than a folder: uploading again supersedes what was there.
 */
export const DEMO_TEST_FORM_SPACE_COVER_SLOT: FormSpaceFileSlot = 'cover';

/**
 * The FOLDER slot of {@link DEMO_TEST_FORM_SPACE_TYPE}. Uploads accumulate rather than superseding.
 */
export const DEMO_TEST_FORM_SPACE_FOLDER_SLOT: FormSpaceFileSlot = 'folder';

/**
 * How many files {@link DEMO_TEST_FORM_SPACE_FOLDER_SLOT} holds.
 */
export const DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES = 4;

/**
 * The shape of the JSON a {@link DEMO_TEST_FORM_SPACE_TYPE} space parks in its `d` field — the "test
 * information" the page's dbx-form collects.
 */
export interface DemoTestFormSpaceData extends FormSpaceData {
  readonly title?: string;
  readonly notes?: string;
  readonly agreed?: boolean;
}

// MARK: demo_guestbook
/**
 * The {@link FormSpaceType} of a Guestbook's SHARED form space.
 *
 * The demo's multi-user case. Unlike every other type here, one space serves a whole guestbook: its `o` is
 * the guestbook's key rather than a profile's, and anyone who has left an entry on that guestbook may read
 * it and upload into it. Its id is derived from the guestbook by {@link demoGuestbookFormSpaceId}, because
 * "one space per guestbook" is its identity and a generated id would let two commenters each mint one.
 */
export const DEMO_GUESTBOOK_FORM_SPACE_TYPE: FormSpaceType = 'demo_guestbook';

/**
 * The shared FOLDER slot of {@link DEMO_GUESTBOOK_FORM_SPACE_TYPE}.
 */
export const DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT: FormSpaceFileSlot = 'photos';

/**
 * How many files {@link DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT} holds, across every commenter.
 */
export const DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_MAX_FILES = 20;

/**
 * The shape of the JSON a {@link DEMO_GUESTBOOK_FORM_SPACE_TYPE} space parks in its `d` field.
 */
export interface DemoGuestbookFormSpaceData extends FormSpaceData {
  readonly caption?: string;
}

/**
 * The id of a Guestbook's single shared {@link DEMO_GUESTBOOK_FORM_SPACE_TYPE} space.
 *
 * Derived rather than issued, so the space resolves with no query and a second concurrent create loses on
 * the create transaction instead of minting a duplicate. A client can also subscribe to it before it has
 * ever been created — "does not exist" IS the "nobody has started the album yet" state.
 *
 * @param guestbookKey - The key of the guestbook the space belongs to.
 * @returns The FormSpaceId, e.g. `gb_abc123`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function demoGuestbookFormSpaceId(guestbookKey: FirestoreModelKey): FormSpaceId {
  return formSpaceIdForModel(guestbookKey);
}

/**
 * Every {@link FormSpaceTypeConfig} the demo app registers.
 *
 * Three shapes on purpose, because they are the three the framework has to get right: a single-user form
 * with validated uploads ({@link DEMO_EXAMPLE_FORM_SPACE_TYPE}), a single-user form without them
 * ({@link DEMO_TEST_FORM_SPACE_TYPE}), and a SHARED one ({@link DEMO_GUESTBOOK_FORM_SPACE_TYPE}). Adding a
 * fourth is still a data entry rather than a code change.
 *
 * Only {@link DEMO_TEST_FORM_SPACE_TYPE} opts into REOPENING. The other two are left as one-way doors on
 * purpose: reopening is opt-in per type, and a demo where every type allowed it would never exercise the
 * refusal a downstream app gets by default.
 */
export const DEMO_FORM_SPACE_TYPE_CONFIGS: FormSpaceTypeConfig[] = [
  {
    formSpaceType: DEMO_EXAMPLE_FORM_SPACE_TYPE,
    name: 'Demo Example Form',
    description: 'An example form space with a required resume and an optional attachment.',
    slots: [
      {
        slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT,
        name: 'Resume',
        required: true,
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 1024 * 1024
      },
      {
        slot: DEMO_EXAMPLE_FORM_SPACE_ATTACHMENT_SLOT,
        name: 'Attachment',
        required: false,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
        maxFileSizeBytes: 2 * 1024 * 1024
      },
      {
        slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT,
        name: 'Supporting Documents',
        required: false,
        maxFiles: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES,
        // the mime type is what the CLIENT declared; validation is what checks the bytes actually agree
        validationRequired: true,
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 2 * 1024 * 1024
      }
    ],
    maxUploads: 16,
    expiresIn: 7 * MS_IN_DAY
  },
  {
    formSpaceType: DEMO_TEST_FORM_SPACE_TYPE,
    name: 'Demo Test Form',
    description: 'A test form space with one required cover file and a folder holding up to four files.',
    slots: [
      {
        slot: DEMO_TEST_FORM_SPACE_COVER_SLOT,
        name: 'Cover File',
        required: true,
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
        maxFileSizeBytes: 2 * 1024 * 1024
      },
      {
        slot: DEMO_TEST_FORM_SPACE_FOLDER_SLOT,
        name: 'Folder',
        required: false,
        maxFiles: DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES,
        // no validationRequired: the demo's coverage of the validation pipeline lives on
        // DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, and a second validated slot would only duplicate it
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'],
        maxFileSizeBytes: 2 * 1024 * 1024
      }
    ],
    // one superseding cover plus four folder files, with slack for a replaced file — and REOPENS replace
    // files too, since `uc` counts uploads accepted over the whole lifetime and a reopen never refunds it
    maxUploads: 12,
    expiresIn: 7 * MS_IN_DAY,
    // The demo's coverage of reopening, and the only type that opts in. Declaring BOTH durations is the
    // interesting case: `reopenableFor` would roll from each submission on its own, and `reopenableUntil`
    // caps the lot from the FIRST one, so a resubmit cannot walk the deadline forward. `maxReopens` bounds
    // it a third way, which is what a purely rolling window would need on its own.
    reopenableFor: 2 * MS_IN_HOUR,
    reopenableUntil: MS_IN_DAY,
    maxReopens: 3
  },
  {
    formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE,
    name: 'Guestbook Album',
    description: 'A shared form space every guestbook signer can upload into.',
    // Declared on the TYPE rather than the one slot: an album is a pile of each signer's own photos, so
    // "your files are yours" is a property of the whole space and a slot added later should inherit it.
    //
    // Signers contribute side by side here; they do not co-own one folder. So a signer reads and removes
    // only what they uploaded, and that includes the album's `u` — the guestbook's creator, who is the
    // party a space happens to be filed under rather than a moderator of everyone else's photos.
    fileAccess: 'uploader',
    slots: [
      {
        slot: DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT,
        name: 'Photos',
        required: false,
        maxFiles: DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_MAX_FILES,
        // no validationRequired: a rejection is written for the file's OWNER to act on, and a shared space
        // has no single owner to act on it
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        maxFileSizeBytes: 4 * 1024 * 1024
      }
    ],
    // bounds the total work every signer can cause between them, not any one signer's share
    maxUploads: 40
    // deliberately no expiresIn: the album is a fixture of the guestbook, not one user's in-progress
    // draft, and retiring it would silently break every signer's upload path. Omitting it means no `eat`
    // is ever written, which is what keeps it out of the expiration sweep's inequality query entirely.
  }
];

/**
 * The demo app's {@link FormSpaceTypeConfig} registry, resolved once.
 *
 * Derived pure data rather than a service with state, so it is built here from the const it indexes rather
 * than injected: the API's upload service, its notification task service, and the model service's own
 * permission checks all need the same answers, and three inline builds are three chances for one of them to
 * be handed a different list.
 */
export const DEMO_FORM_SPACE_TYPE_CONFIG_SERVICE: AppFormSpaceTypeConfigService = appFormSpaceTypeConfigService(formSpaceTypeConfigRecord(DEMO_FORM_SPACE_TYPE_CONFIGS));
