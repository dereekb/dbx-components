import { InjectionToken } from '@nestjs/common';
import { NotificationTemplateType, NotificationMessageFunctionFactory } from '@dereekb/firebase';

// MARK: Tokens
/**
 * Token to access/override the NotificationTemplateService's defaults records.
 */
export const NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN: InjectionToken = 'NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE';

/**
 * Token to access the NotificationTemplateService's type configs array.
 */
export const NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN: InjectionToken = 'NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY';

// MARK: Config
/**
 * Configuration object used by the NotificationTemplateService to describe how to respond to a NotificationTemplateType request for a NotificationMessageFunctionFactory.
 */
export interface NotificationTemplateServiceTypeConfig {
  /**
   * Type this config overrides.
   */
  readonly type: NotificationTemplateType;
  /**
   * Factory for messages of this type.
   */
  factory: NotificationMessageFunctionFactory<any>;
}

/**
 * Used by NotificationTemplateService for template configurations.
 */
export type NotificationTemplateServiceTypeConfigArray = NotificationTemplateServiceTypeConfig[];

/**
 * A record of default NotificationMessageFunctionFactory valeus to use for specific NotificationTemplateType values.
 */
export type NotificationTemplateServiceDefaultsRecord = Record<NotificationTemplateType, NotificationMessageFunctionFactory>;
