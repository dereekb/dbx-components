import { type ISO8601DateString, type UniqueModelWithId } from '@dereekb/util';
import { type ZohoCrmReferenceData, type ZohoCrmParentReferenceData, type ZohoCrmTypeId, type ZohoCrmModuleName, type ZohoCrmCreatedByData, type ZohoCrmModifiedByData, type ZohoCrmId } from './crm';

// MARK: Notes
export type ZohoCrmNoteId = string;

export interface ZohoCrmNoteAction {
  $is_system_action: boolean;
}

export type ZohoCrmNoteSourceName = 'NORMAL_USER';
export type ZohoCrmNoteSourceType = number;

export interface ZohoCrmNoteSource {
  name: ZohoCrmNoteSourceName;
  type: ZohoCrmNoteSourceType;
}

export type ZohoCrmNoteOwnerData = ZohoCrmReferenceData;

export interface ZohoCrmNoteData {
  Note_Title: string;
  Note_Content: string;
  Parent_Id: ZohoCrmParentReferenceData;
  Created_Time: ISO8601DateString;
  Modified_Time: ISO8601DateString;
  $attachments: null;
  $is_edit_allowed: boolean;
  $editable: boolean;
  $type_id: ZohoCrmTypeId;
  $is_delete_allowed: boolean;
  $note_action: ZohoCrmNoteAction;
  $source: ZohoCrmNoteSource;
  $se_module: ZohoCrmModuleName;
  $is_shared_to_client: boolean;
  Note_Owner: ZohoCrmNoteOwnerData;
  Created_By: ZohoCrmCreatedByData;
  Modified_By: ZohoCrmModifiedByData;
  $size: ZohoCrmNoteFileSize | null;
  $voice_note: boolean;
  $status: ZohoCrmNoteStatus;
}

export interface NewZohoCrmNoteData extends Pick<ZohoCrmNoteData, 'Note_Title' | 'Note_Content'> {
  Parent_Id: Pick<ZohoCrmParentReferenceData, 'id'> | ZohoCrmId;
  se_module: ZohoCrmModuleName;
}

export type ZohoCrmNoteStatus = string; // TODO
export type ZohoCrmNoteFileSize = number;

export interface ZohoCrmNote extends ZohoCrmNoteData, UniqueModelWithId {}

export type ZohoCrmRecordNote = ZohoCrmNote;

// MARK: Compat
/**
 * @deprecated use NewZohoCrmNewNoteData instead.
 */
export type NewZohoCrmNewNoteData = NewZohoCrmNoteData;
