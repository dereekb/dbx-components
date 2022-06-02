import { Expose } from 'class-transformer';
import { FirebaseFunctionMap, firebaseFunctionMapFactory, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, ModelFirebaseCrudFunction, ModelFirebaseCrudFunctionConfigMap, ModelFirebaseFunctionMap, modelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { IsOptional, IsNotEmpty, IsString, MaxLength, IsBoolean } from 'class-validator';
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

export type GuestbookFunctionTypeMap = {};

export const guestbookFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<GuestbookFunctionTypeMap> = {};

export type GuestbookModelCrudFunctionsConfig = {
  guestbook: null;
  guestbookEntry: {
    update: UpdateGuestbookEntryParams;
    delete: GuestbookEntryParams;
  };
};

export const guestbookModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<GuestbookModelCrudFunctionsConfig> = {
  guestbookEntry: ['update', 'delete']
};

export const guestbookFunctionMap = modelFirebaseFunctionMapFactory(guestbookFunctionTypeConfigMap, guestbookModelCrudFunctionsConfig);

export abstract class GuestbookFunctions implements ModelFirebaseFunctionMap<GuestbookFunctionTypeMap, GuestbookModelCrudFunctionsConfig> {
  abstract guestbookEntry: { updateGuestbookEntry: ModelFirebaseCrudFunction<UpdateGuestbookEntryParams>; deleteGuestbookEntry: ModelFirebaseCrudFunction<GuestbookEntryParams> };
}
