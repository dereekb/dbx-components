import { type ISO8601DateString, type UniqueModelWithId } from '@dereekb/util';
import { type ZohoRecruitReferenceData, type ZohoRecruitParentReferenceData, type ZohoRecruitTypeId, type ZohoRecruitModuleName, type ZohoRecruitCreatedByData, type ZohoRecruitModifiedByData, type ZohoRecruitId } from './recruit';

// MARK: Notes
export type ZohoRecruitNoteId = string;

export interface ZohoRecruitNoteAction {
  $is_system_action: boolean;
}

export type ZohoRecruitNoteSourceName = 'NORMAL_USER';
export type ZohoRecruitNoteSourceType = number;

export interface ZohoRecruitNoteSource {
  name: ZohoRecruitNoteSourceName;
  type: ZohoRecruitNoteSourceType;
}

export type ZohoRecruitNoteOwnerData = ZohoRecruitReferenceData;

export interface ZohoRecruitNoteData {
  Note_Title: string;
  Note_Content: string;
  Parent_Id: ZohoRecruitParentReferenceData;
  Created_Time: ISO8601DateString;
  Modified_Time: ISO8601DateString;
  $attachments: null;
  $is_edit_allowed: boolean;
  $editable: boolean;
  $type_id: ZohoRecruitTypeId;
  $is_delete_allowed: boolean;
  $note_action: ZohoRecruitNoteAction;
  $source: ZohoRecruitNoteSource;
  $se_module: ZohoRecruitModuleName;
  $is_shared_to_client: boolean;
  Note_Owner: ZohoRecruitNoteOwnerData;
  Created_By: ZohoRecruitCreatedByData;
  Modified_By: ZohoRecruitModifiedByData;
  $size: ZohoRecruitNoteFileSize | null;
  $voice_note: boolean;
  $status: ZohoRecruitNoteStatus;
}

export interface NewZohoRecruitNoteData extends Pick<ZohoRecruitNoteData, 'Note_Title' | 'Note_Content'> {
  Parent_Id: Pick<ZohoRecruitParentReferenceData, 'id'> | ZohoRecruitId;
  se_module: ZohoRecruitModuleName;
}

export type ZohoRecruitNoteStatus = string; // TODO
export type ZohoRecruitNoteFileSize = number;

export interface ZohoRecruitNote extends ZohoRecruitNoteData, UniqueModelWithId {}

export type ZohoRecruitRecordNote = ZohoRecruitNote;

// MARK: Compat
/**
 * @deprecated use NewZohoRecruitNewNoteData instead.
 */
export type NewZohoRecruitNewNoteData = NewZohoRecruitNoteData;
