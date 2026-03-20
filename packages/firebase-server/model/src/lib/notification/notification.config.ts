import { type InjectionToken } from '@nestjs/common';
import { type NotificationTemplateType, type NotificationMessageFunctionFactory } from '@dereekb/firebase';

// MARK: Tokens
/**
 * NestJS injection token for overriding the default {@link NotificationMessageFunctionFactory} values
 * used by {@link NotificationTemplateService} when no type-specific config is found.
 *
 * Provide a {@link NotificationTemplateServiceDefaultsRecord} at this token to set baseline
 * message factories for each {@link NotificationTemplateType}.
 */
export const NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN: InjectionToken = 'NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE';

/**
 * NestJS injection token for the array of type-specific template configurations
 * consumed by {@link NotificationTemplateService}.
 *
 * Provide a {@link NotificationTemplateServiceTypeConfigArray} at this token to register
 * message factories for individual {@link NotificationTemplateType} values.
 */
export const NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN: InjectionToken = 'NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY';

// MARK: Config
/**
 * Maps a single {@link NotificationTemplateType} to its {@link NotificationMessageFunctionFactory},
 * telling {@link NotificationTemplateService} how to build notification messages of that type.
 */
export interface NotificationTemplateServiceTypeConfig {
  /**
   * The notification template type this config handles.
   */
  readonly type: NotificationTemplateType;
  /**
   * Factory that creates {@link NotificationMessageFunction} instances for this type.
   */
  readonly factory: NotificationMessageFunctionFactory<any>;
}

/**
 * Array of {@link NotificationTemplateServiceTypeConfig} entries registered
 * via {@link NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN}.
 */
export type NotificationTemplateServiceTypeConfigArray = NotificationTemplateServiceTypeConfig[];

/**
 * Record mapping each {@link NotificationTemplateType} to a default {@link NotificationMessageFunctionFactory}.
 *
 * Used as the fallback when no type-specific {@link NotificationTemplateServiceTypeConfig} is registered.
 */
export type NotificationTemplateServiceDefaultsRecord = Record<NotificationTemplateType, NotificationMessageFunctionFactory>;
