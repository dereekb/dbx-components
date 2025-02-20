import { type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionDeleteAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionDeleteAction, type FirebaseFunctionUpdateAction } from '../../common';
import { type NotificationSummaryDocument, type NotificationBoxDocument, type NotificationDocument, type NotificationWeekDocument, type NotificationUserDocument } from './notification';

export type NotificationUserCreateAction<P extends object> = FirebaseFunctionCreateAction<P, NotificationUserDocument>;
export type AsyncNotificationUserCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, NotificationUserDocument>;

export type NotificationUserUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, NotificationUserDocument>;
export type AsyncNotificationUserUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, NotificationUserDocument>;

export type NotificationSummaryCreateAction<P extends object> = FirebaseFunctionCreateAction<P, NotificationSummaryDocument>;
export type AsyncNotificationSummaryCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, NotificationSummaryDocument>;

export type NotificationSummaryUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, NotificationSummaryDocument>;
export type AsyncNotificationSummaryUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, NotificationSummaryDocument>;

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
