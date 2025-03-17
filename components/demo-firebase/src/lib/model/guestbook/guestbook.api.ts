import { Expose } from 'class-transformer';
import { FirebaseFunctionTypeConfigMap, ModelFirebaseCreateFunction, ModelFirebaseCrudFunction, ModelFirebaseCrudFunctionConfigMap, ModelFirebaseFunctionMap, AbstractSubscribeToNotificationBoxParams, TargetModelParams, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { IsOptional, IsNotEmpty, IsString, MaxLength, IsBoolean } from 'class-validator';
import { GuestbookTypes } from './guestbook';
import { type Maybe } from '@dereekb/util';

export const GUESTBOOK_NAME_MAX_LENGTH = 40;

export const GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH = 200;
export const GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH = 40;

export class CreateGuestbookParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(GUESTBOOK_NAME_MAX_LENGTH)
  name!: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  published?: Maybe<boolean>;
}

export abstract class GuestbookEntryParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  guestbook!: string; // ModelKey;
}

export class InsertGuestbookEntryParams extends GuestbookEntryParams {
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

export class LikeGuestbookEntryParams extends TargetModelParams {}

export class SubscribeToGuestbookNotificationsParams extends AbstractSubscribeToNotificationBoxParams {}

export type GuestbookFunctionTypeMap = {};

export const guestbookFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<GuestbookFunctionTypeMap> = {};

export type GuestbookModelCrudFunctionsConfig = {
  guestbook: {
    create: CreateGuestbookParams;
    update: {
      subscribeToNotifications: SubscribeToGuestbookNotificationsParams;
    };
  };
  guestbookEntry: {
    update: {
      insert: InsertGuestbookEntryParams;
      like: LikeGuestbookEntryParams;
    };
    delete: GuestbookEntryParams;
  };
};

export const guestbookModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<GuestbookModelCrudFunctionsConfig, GuestbookTypes> = {
  guestbook: ['create', 'update:subscribeToNotifications'],
  guestbookEntry: ['update:insert,like', 'delete']
};

export const guestbookFunctionMap = callModelFirebaseFunctionMapFactory(guestbookFunctionTypeConfigMap, guestbookModelCrudFunctionsConfig);

export abstract class GuestbookFunctions implements ModelFirebaseFunctionMap<GuestbookFunctionTypeMap, GuestbookModelCrudFunctionsConfig> {
  abstract guestbook: {
    createGuestbook: ModelFirebaseCreateFunction<CreateGuestbookParams>;
    updateGuestbook: {
      subscribeToNotifications: ModelFirebaseCrudFunction<SubscribeToGuestbookNotificationsParams>;
    };
  };
  abstract guestbookEntry: {
    updateGuestbookEntry: {
      insert: ModelFirebaseCrudFunction<InsertGuestbookEntryParams>;
      like: ModelFirebaseCrudFunction<LikeGuestbookEntryParams>;
    };
    deleteGuestbookEntry: ModelFirebaseCrudFunction<GuestbookEntryParams>;
  };
}
