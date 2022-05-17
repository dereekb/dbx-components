import { Expose } from "class-transformer";
import { FirebaseFunctionMap, firebaseFunctionMapFactory, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap } from "@dereekb/firebase";
import { IsOptional, IsNotEmpty, IsString, MaxLength, IsBoolean } from "class-validator";
import { ModelKey } from '@dereekb/util';

export const GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH = 200;
export const GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH = 40;

export abstract class GuestbookEntryParams {

  @Expose()
  @IsNotEmpty()
  @IsString()
  guestbook!: ModelKey;

}

export class UpdateGuestbookEntryParams extends GuestbookEntryParams {

  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH)
  message?: string;

  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH)
  signed?: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  published?: boolean;

}

export const updateGuestbookEntryKey = 'updateGuestbookEntry';
export const deleteGuestbookEntryKey = 'deleteGuestbookEntry';

export type GuestbookFunctionTypeMap = {
  [updateGuestbookEntryKey]: [UpdateGuestbookEntryParams, void]
  [deleteGuestbookEntryKey]: [GuestbookEntryParams, void]
}

export const guestbookFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<GuestbookFunctionTypeMap> = {
  [updateGuestbookEntryKey]: null,
  [deleteGuestbookEntryKey]: null
}

export abstract class GuestbookFunctions implements FirebaseFunctionMap<GuestbookFunctionTypeMap> {
  [updateGuestbookEntryKey]: FirebaseFunctionMapFunction<GuestbookFunctionTypeMap, 'updateGuestbookEntry'>;
  [deleteGuestbookEntryKey]: FirebaseFunctionMapFunction<GuestbookFunctionTypeMap, 'deleteGuestbookEntry'>;
}

export const guestbookFunctionMap = firebaseFunctionMapFactory(guestbookFunctionTypeConfigMap);
