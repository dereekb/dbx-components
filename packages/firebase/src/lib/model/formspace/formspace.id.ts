import { type FirestoreModelId, type FirestoreModelKey, twoWayFlatFirestoreModelKey } from '../../common';

/**
 * @module formspace.id
 *
 * Identity types for the FormSpace model.
 *
 * A FormSpace has an ARBITRARY, auto-generated id rather than an id derived from another model's key: a
 * user may hold several spaces of the same type against the same target at once (a resubmission, a second
 * application), so a derived id would make two concurrent drafts collide. The association to another model
 * is carried by the optional `m` (targetModelKey) field instead.
 */

/**
 * Firestore document id for a FormSpace. Auto-generated.
 */
export type FormSpaceId = FirestoreModelId;

/**
 * Full Firestore document key (collection path + id) for a FormSpace.
 */
export type FormSpaceKey = FirestoreModelKey;

/**
 * The {@link FormSpaceId} of a space whose identity IS the model it was opened against.
 *
 * `formSpaceIdForModel('gb/abc123') // 'gb_abc123'`
 *
 * The DEFAULT shape is the one this module's own doc describes: an arbitrary id, because several concurrent
 * drafts may target one model. This is the other shape — a space SHARED by everyone who reaches the target,
 * where "one space per target" is the identity itself. There, a generated id is a bug rather than a
 * convenience: two callers bootstrapping at once each mint a "shared" space, and neither sees the other's
 * files. Deriving the id makes the create idempotent and lets a client read the space with a plain `get`
 * before it has ever called create.
 *
 * Same construction as {@link calendarIdForModel}, and for the same reason.
 */
export const formSpaceIdForModel = twoWayFlatFirestoreModelKey;

/**
 * Arbitrary string describing the kind of form a FormSpace holds, driving its upload restrictions, its
 * expiration policy, and the server-side handler its submission is dispatched to through the app's
 * {@link FormSpaceTypeConfig} registry.
 *
 * Open by design, exactly like {@link StorageFilePurpose} and {@link CalendarType}: a downstream app
 * registers its own types without a library change.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:form-space
 */
export type FormSpaceType = string;

/**
 * Names one upload "slot" within a FormSpace — the resume, the cover letter, the photo of the ID.
 *
 * A slot is stored on the uploaded {@link StorageFile} as its `pg` (purposeSubgroup), which is what makes
 * "replace the file in this slot" the existing `flagPreviousForDelete` behaviour rather than new machinery.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:form-space
 */
export type FormSpaceFileSlot = string;
