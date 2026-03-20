import { type Maybe } from '@dereekb/util';
import { Inject, Optional } from '@nestjs/common';
import { noContentNotificationMessageFunctionFactory, type NotificationMessageFunction, type NotificationMessageFunctionFactory, type NotificationMessageFunctionFactoryConfig, type NotificationTemplateType } from '@dereekb/firebase';
import { type NotificationTemplateServiceTypeConfig, NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, type NotificationTemplateServiceTypeConfigArray, type NotificationTemplateServiceDefaultsRecord } from './notification.config';

/**
 * Provides a reference to a {@link NotificationTemplateService} instance.
 */
export interface NotificationTemplateServiceRef {
  readonly notificationTemplateService: NotificationTemplateService;
}

/**
 * Resolves {@link NotificationMessageFunctionFactory} instances for a given {@link NotificationTemplateType}.
 *
 * Combines an optional defaults record (injected via {@link NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN})
 * with per-type configs (injected via {@link NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN}) to determine
 * which factory to use. If a type has no registered config or default, a no-content fallback factory is used.
 *
 * @example
 * ```ts
 * const instance = notificationTemplateService.templateInstanceForType('welcome');
 * const messageFn = await instance.loadMessageFunction({ notification, notificationBox });
 * ```
 */
export class NotificationTemplateService {
  private readonly _defaults: NotificationTemplateServiceDefaultsRecord;
  private readonly _config: Map<NotificationTemplateType, NotificationTemplateServiceTypeConfig>;

  constructor(
    //
    @Optional() @Inject(NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN) _inputDefaults: NotificationTemplateServiceDefaultsRecord | undefined,
    @Inject(NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN) _inputConfigs: NotificationTemplateServiceTypeConfigArray | undefined
  ) {
    this._defaults = _inputDefaults ?? {};

    this._config = new Map<NotificationTemplateType, NotificationTemplateServiceTypeConfig>();
    if (_inputConfigs != null) {
      _inputConfigs.forEach((x) => {
        this._config.set(x.type, x);
      });
    }
  }

  /**
   * Returns the default factory and optional type-specific config for the given template type.
   *
   * @param type - the notification template type to look up
   * @returns a tuple of [defaultFactory, typeConfig] where either may be undefined
   */
  configPairForType(type: NotificationTemplateType): [NotificationMessageFunctionFactory, Maybe<NotificationTemplateServiceTypeConfig>] {
    return [this._defaults[type], this._config.get(type)];
  }

  /**
   * Creates a {@link NotificationTemplateServiceInstance} scoped to a single template type,
   * pre-wired with the resolved factory for that type.
   *
   * @param type - the notification template type
   * @returns a new {@link NotificationTemplateServiceInstance} bound to the given type
   */
  templateInstanceForType(type: NotificationTemplateType): NotificationTemplateServiceInstance {
    return notificationTemplateServiceInstance(this, type);
  }
}

/**
 * Loads or creates a {@link NotificationMessageFunction} for a specific notification,
 * using the factory resolved by {@link NotificationTemplateService}.
 *
 * @param config - contextual data (notification, box, recipients) needed to build the message function
 */
export type LoadNotificationMessageFunction = (config: NotificationMessageFunctionFactoryConfig) => Promise<NotificationMessageFunction>;

/**
 * NotificationTemplateService instance that provides access to message functions of a certain type.
 */
export interface NotificationTemplateServiceInstance {
  /**
   * Parent service
   */
  readonly service: NotificationTemplateService;
  /**
   * The type of template this instance contains/represents.
   */
  readonly type: NotificationTemplateType;
  /**
   * True if the template type is configured in the NotificationTemplateService.
   */
  readonly isConfiguredType: boolean;
  /**
   * The LoadNotificationMessageFunction for the type.
   */
  readonly loadMessageFunction: LoadNotificationMessageFunction;
}

/**
 * Creates a {@link NotificationTemplateServiceInstance} bound to a specific template type.
 *
 * Resolves the factory from the service's type-specific config first, falling back to
 * a no-content default factory when no config is registered for the type.
 *
 * @param service - the parent template service
 * @param type - the template type to bind
 * @returns a {@link NotificationTemplateServiceInstance} with the resolved factory for the type
 *
 * @example
 * ```ts
 * const instance = notificationTemplateServiceInstance(service, 'order_update');
 * if (instance.isConfiguredType) {
 *   const messageFn = await instance.loadMessageFunction(config);
 * }
 * ```
 */
export function notificationTemplateServiceInstance(service: NotificationTemplateService, type: NotificationTemplateType): NotificationTemplateServiceInstance {
  const pair = service.configPairForType(type);
  const isKnownType = pair[0] != null || pair[1] != null;
  const defaultFactory = noContentNotificationMessageFunctionFactory();
  const instanceConfig = pair[1];

  return {
    service,
    type,
    isConfiguredType: isKnownType,
    loadMessageFunction: async (config: NotificationMessageFunctionFactoryConfig) => {
      const factory = instanceConfig?.factory ?? defaultFactory;
      return factory(config);
    }
  };
}
