import { Maybe } from '@dereekb/util';
import { Inject, Optional } from '@nestjs/common';
import { noContentNotificationMessageFunctionFactory, NotificationMessageFunction, NotificationMessageFunctionFactory, NotificationMessageFunctionFactoryConfig, NotificationTemplateType } from '@dereekb/firebase';
import { NotificationTemplateServiceTypeConfig, NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN } from './notification.config';

export interface NotificationTemplateServiceRef {
  readonly notificationTemplateService: NotificationTemplateService;
}

/**
 * Service dedicated to providing access to NotificationMessageFunctionFactory values for specific NotificationTemplateTypes.
 */
export class NotificationTemplateService {
  private readonly _defaults: Record<NotificationTemplateType, NotificationMessageFunctionFactory>;
  private readonly _config: Map<NotificationTemplateType, NotificationTemplateServiceTypeConfig>;

  constructor(
    //
    @Optional() @Inject(NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN) _inputDefaults: Record<NotificationTemplateType, NotificationMessageFunctionFactory> | undefined,
    @Optional() @Inject(NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN) _inputConfigs: NotificationTemplateServiceTypeConfig[] | undefined
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
    return new NotificationTemplateServiceInstance(this, type);
  }
}

/**
 * NotificationTemplateService instance that provides access to message functions of a certain type.
 */
export class NotificationTemplateServiceInstance {
  private readonly _service: NotificationTemplateService;
  private readonly _type: NotificationTemplateType;

  private readonly _isKnownType: boolean;
  private readonly _defaultFactory: NotificationMessageFunctionFactory;
  private readonly _config: Maybe<NotificationTemplateServiceTypeConfig>;

  constructor(service: NotificationTemplateService, type: NotificationTemplateType) {
    this._service = service;
    this._type = type;
    const pair = service.configPairForType(type);
    this._isKnownType = pair[0] != null || pair[1] != null;
    this._defaultFactory = noContentNotificationMessageFunctionFactory();
    this._config = pair[1];
  }

  get service() {
    return this._service;
  }

  get type() {
    return this._type;
  }

  get isKnownType() {
    return this._isKnownType;
  }

  async loadMessageFunction(config: NotificationMessageFunctionFactoryConfig): Promise<NotificationMessageFunction> {
    const factory = this._config?.factory ?? this._defaultFactory;
    return factory(config);
  }
}
