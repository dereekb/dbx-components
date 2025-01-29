import { type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionDeleteAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionDeleteAction, type FirebaseFunctionUpdateAction } from '@dereekb/firebase';
import { type NotificationBoxDocument, type NotificationDocument, type NotificationWeekDocument } from './notification';

export type NotificationBoxCreateAction<P extends object> = FirebaseFunctionCreateAction<P, NotificationBoxDocument>;
export type AsyncNotificationBoxCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, NotificationBoxDocument>;

export type NotificationBoxUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, NotificationBoxDocument>;
export type AsyncNotificationBoxUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, NotificationBoxDocument>;

export type NotificationCreateAction<P extends object> = FirebaseFunctionCreateAction<P, NotificationDocument, NotificationBoxDocument>;
export type AsyncNotificationCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, NotificationDocument, NotificationBoxDocument>;

export type NotificationUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, NotificationDocument>;
export type AsyncNotificationUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, NotificationDocument>;

export type NotificationDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, NotificationDocument>;
export type AsyncNotificationDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, NotificationDocument>;

export type NotificationWeekCreateAction<P extends object> = FirebaseFunctionCreateAction<P, NotificationWeekDocument>;
export type AsyncNotificationWeekCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, NotificationWeekDocument>;

export type NotificationWeekUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, NotificationWeekDocument>;
export type AsyncNotificationWeekUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, NotificationWeekDocument>;
