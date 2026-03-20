import { type ISO8601DateString, type UniqueModelWithId } from '@dereekb/util';
import { type ZohoCrmReferenceData, type ZohoCrmParentReferenceData, type ZohoCrmTypeId, type ZohoCrmModuleName, type ZohoCrmCreatedByData, type ZohoCrmModifiedByData, type ZohoCrmId } from './crm';

// MARK: Notes
/**
 * Unique identifier for a CRM note.
 */
export type ZohoCrmNoteId = string;

/**
 * Metadata describing whether the note action was triggered by the system.
 */
export interface ZohoCrmNoteAction {
  readonly $is_system_action: boolean;
}

/**
 * Known source name indicating the note was created by a normal user.
 */
export type ZohoCrmNoteSourceName = 'NORMAL_USER';
/**
 * Numeric source type identifier for a note.
 */
export type ZohoCrmNoteSourceType = number;

/**
 * Describes the origin of a note, including who or what created it.
 */
export interface ZohoCrmNoteSource {
  readonly name: ZohoCrmNoteSourceName;
  readonly type: ZohoCrmNoteSourceType;
}

/**
 * Reference data identifying the owner of a note.
 */
export type ZohoCrmNoteOwnerData = ZohoCrmReferenceData;

/**
 * Full data shape for a CRM note as returned by the API, including metadata fields like permissions, source, and timestamps.
 */
export interface ZohoCrmNoteData {
  readonly Note_Title: string;
  readonly Note_Content: string;
  readonly Parent_Id: ZohoCrmParentReferenceData;
  readonly Created_Time: ISO8601DateString;
  readonly Modified_Time: ISO8601DateString;
  readonly $attachments: null;
  readonly $is_edit_allowed: boolean;
  readonly $editable: boolean;
  readonly $type_id: ZohoCrmTypeId;
  readonly $is_delete_allowed: boolean;
  readonly $note_action: ZohoCrmNoteAction;
  readonly $source: ZohoCrmNoteSource;
  readonly $se_module: ZohoCrmModuleName;
  readonly $is_shared_to_client: boolean;
  readonly Note_Owner: ZohoCrmNoteOwnerData;
  readonly Created_By: ZohoCrmCreatedByData;
  readonly Modified_By: ZohoCrmModifiedByData;
  readonly $size: ZohoCrmNoteFileSize | null;
  readonly $voice_note: boolean;
  readonly $status: ZohoCrmNoteStatus;
}

/**
 * Data required to create a new note, including the parent record reference and target module.
 */
export interface NewZohoCrmNoteData extends Pick<ZohoCrmNoteData, 'Note_Title' | 'Note_Content'> {
  Parent_Id: Pick<ZohoCrmParentReferenceData, 'id'> | ZohoCrmId;
  se_module: ZohoCrmModuleName;
}

/**
 * Status string for a note. Exact values are not yet fully documented.
 */
export type ZohoCrmNoteStatus = string; // TODO
/**
 * File size in bytes for any attachment associated with a note.
 */
export type ZohoCrmNoteFileSize = number;

/**
 * A CRM note with a unique identifier, combining full note data with the model identity.
 */
export interface ZohoCrmNote extends ZohoCrmNoteData, UniqueModelWithId {}

/**
 * A note associated with a specific CRM record. Currently identical to {@link ZohoCrmNote}.
 */
export type ZohoCrmRecordNote = ZohoCrmNote;

// MARK: Compat
/**
 * @deprecated use NewZohoCrmNewNoteData instead.
 */
export type NewZohoCrmNewNoteData = NewZohoCrmNoteData;
