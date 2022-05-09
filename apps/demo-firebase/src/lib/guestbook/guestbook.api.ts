import { GuestbookEntry } from './guestbook';
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

export const guestbookEntryUpdateKey = 'guestbookEntryUpdateEntry';
export const guestbookEntryDeleteKey = 'guestbookEntryDeleteEntry';

export type GuestbookFunctionTypeMap = {
  [guestbookEntryUpdateKey]: [UpdateGuestbookEntryParams, GuestbookEntry]
  [guestbookEntryDeleteKey]: [GuestbookEntryParams, GuestbookEntry]
}

export const guestbookFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<GuestbookFunctionTypeMap> = {
  [guestbookEntryUpdateKey]: null,
  [guestbookEntryDeleteKey]: null
}

export abstract class GuestbookFunctions implements FirebaseFunctionMap<GuestbookFunctionTypeMap> {
  [guestbookEntryUpdateKey]: FirebaseFunctionMapFunction<GuestbookFunctionTypeMap, 'guestbookEntryUpdateEntry'>;
  [guestbookEntryDeleteKey]: FirebaseFunctionMapFunction<GuestbookFunctionTypeMap, 'guestbookEntryDeleteEntry'>;
}

export const guestbookFunctionMap = firebaseFunctionMapFactory(guestbookFunctionTypeConfigMap);
