import { type Maybe } from '@dereekb/util';
import { Inject, Optional } from '@nestjs/common';
import { noContentNotificationMessageFunctionFactory, type NotificationMessageFunction, type NotificationMessageFunctionFactory, type NotificationMessageFunctionFactoryConfig, type NotificationTemplateType } from '@dereekb/firebase';
import { type NotificationTemplateServiceTypeConfig, NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, type NotificationTemplateServiceTypeConfigArray, type NotificationTemplateServiceDefaultsRecord } from './notification.config';

export interface NotificationTemplateServiceRef {
  readonly notificationTemplateService: NotificationTemplateService;
}

/**
 * Service dedicated to providing access to NotificationMessageFunctionFactory values for specific NotificationTemplateTypes.
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

  configPairForType(type: NotificationTemplateType): [NotificationMessageFunctionFactory, Maybe<NotificationTemplateServiceTypeConfig>] {
    return [this._defaults[type], this._config.get(type)];
  }

  templateInstanceForType(type: NotificationTemplateType): NotificationTemplateServiceInstance {
    return notificationTemplateServiceInstance(this, type);
  }
}

/**
 * Loads/creates a NotificationMessageFunction based on the input configuration.
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
 * Creates a NotificationTemplateServiceInstance.
 *
 * @param service
 * @param type
 * @returns
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
