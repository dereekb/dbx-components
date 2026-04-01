import { type FirebaseFunctionTypeConfigMap, type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type AbstractSubscribeToNotificationBoxParams, abstractSubscribeToNotificationBoxParamsType, type TargetModelParams, targetModelParamsType, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { type, type Type } from 'arktype';
import { type GuestbookTypes } from './guestbook';
import { type Maybe } from '@dereekb/util';
import { clearable } from '@dereekb/model';

export const GUESTBOOK_NAME_MAX_LENGTH = 40;

export const GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH = 200;
export const GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH = 40;

export interface CreateGuestbookParams {
  readonly name: string;
  readonly published?: Maybe<boolean>;
}

export const createGuestbookParamsType = type({
  name: `string > 0 & string <= ${GUESTBOOK_NAME_MAX_LENGTH}`,
  'published?': clearable('boolean')
}) as Type<CreateGuestbookParams>;

export interface GuestbookEntryParams {
  readonly guestbook: string; // ModelKey;
}

export const guestbookEntryParamsType = type({
  guestbook: 'string > 0'
}) as Type<GuestbookEntryParams>;

export interface InsertGuestbookEntryParams extends GuestbookEntryParams {
  readonly message?: string;
  readonly signed?: string;
  readonly published?: boolean;
}

export const insertGuestbookEntryParamsType = guestbookEntryParamsType.merge({
  'message?': clearable(`string > 0 & string <= ${GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH}`),
  'signed?': clearable(`string > 0 & string <= ${GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH}`),
  'published?': clearable('boolean')
}) as Type<InsertGuestbookEntryParams>;

export type LikeGuestbookEntryParams = TargetModelParams;

export const likeGuestbookEntryParamsType = targetModelParamsType as Type<LikeGuestbookEntryParams>;

export type SubscribeToGuestbookNotificationsParams = AbstractSubscribeToNotificationBoxParams;

export const subscribeToGuestbookNotificationsParamsType = abstractSubscribeToNotificationBoxParamsType as Type<SubscribeToGuestbookNotificationsParams>;

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
