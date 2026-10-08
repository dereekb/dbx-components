import { type Maybe, unique } from '@dereekb/util';
import { Inject, Optional } from '@nestjs/common';
import { type AppNotificationTemplateTypeInfoRecordServiceRef, noContentNotificationMessageFunctionFactory, type NotificationMessageFunction, type NotificationMessageFunctionFactory, type NotificationMessageFunctionFactoryConfig, type NotificationTemplateType } from '@dereekb/firebase';
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
   * @param type - The notification template type to look up.
   * @returns A tuple of [defaultFactory, typeConfig] where either may be undefined.
   */
  configPairForType(type: NotificationTemplateType): [NotificationMessageFunctionFactory, Maybe<NotificationTemplateServiceTypeConfig>] {
    return [this._defaults[type], this._config.get(type)];
  }

  /**
   * Returns every template type that has a message factory, from the type configs or the defaults.
   *
   * @returns The configured template types.
   */
  configuredTemplateTypes(): NotificationTemplateType[] {
    return unique([...Object.keys(this._defaults), ...Array.from(this._config.keys())]);
  }

  /**
   * Creates a {@link NotificationTemplateServiceInstance} scoped to a single template type,
   * pre-wired with the resolved factory for that type.
   *
   * @param type - The notification template type.
   * @returns A new {@link NotificationTemplateServiceInstance} bound to the given type.
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
 * @param service - The parent template service.
 * @param type - The template type to bind.
 * @returns A {@link NotificationTemplateServiceInstance} with the resolved factory for the type.
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

// MARK: Validation
/**
 * Input for {@link notificationTemplateServiceTemplateTypeMismatches}.
 */
export type NotificationTemplateServiceTemplateTypeMismatchesInput = NotificationTemplateServiceRef & AppNotificationTemplateTypeInfoRecordServiceRef;

/**
 * The template types that a {@link NotificationTemplateService} and the app's `NotificationTemplateTypeInfo` record disagree on.
 */
export interface NotificationTemplateServiceTemplateTypeMismatches {
  /**
   * Template types that have a message factory, but no `NotificationTemplateTypeInfo`. They would send with the default opt-in rules, and
   * never show in the users' notification settings.
   */
  readonly unknownTemplateTypes: NotificationTemplateType[];
  /**
   * Template types that have a `NotificationTemplateTypeInfo`, but no message factory. Their notifications would never send.
   */
  readonly unconfiguredTemplateTypes: NotificationTemplateType[];
}

/**
 * Compares the template types that a {@link NotificationTemplateService} has message factories for with the app's `NotificationTemplateTypeInfo` record.
 *
 * @param input - The template service and the app's template type info.
 * @returns The template types that have a message factory but no info, and the ones that have info but no message factory.
 */
export function notificationTemplateServiceTemplateTypeMismatches(input: NotificationTemplateServiceTemplateTypeMismatchesInput): NotificationTemplateServiceTemplateTypeMismatches {
  const { notificationTemplateService, appNotificationTemplateTypeInfoRecordService } = input;
  const { appNotificationTemplateTypeInfoRecord } = appNotificationTemplateTypeInfoRecordService;
  const configuredTemplateTypes = notificationTemplateService.configuredTemplateTypes();
  const configured = new Set(configuredTemplateTypes);

  return {
    unknownTemplateTypes: configuredTemplateTypes.filter((type) => appNotificationTemplateTypeInfoRecord[type] == null),
    unconfiguredTemplateTypes: appNotificationTemplateTypeInfoRecordService.getAllKnownTemplateTypes().filter((type) => !configured.has(type))
  };
}

/**
 * Asserts that every template type with a message factory has a `NotificationTemplateTypeInfo`, and that every template type with a
 * `NotificationTemplateTypeInfo` has a message factory. See {@link notificationTemplateServiceTemplateTypeMismatches}.
 *
 * @param input - The template service and the app's template type info.
 * @throws {Error} When a template type has a message factory but no info, or info but no message factory.
 */
export function assertNotificationTemplateServiceTemplateTypes(input: NotificationTemplateServiceTemplateTypeMismatchesInput): void {
  const { unknownTemplateTypes, unconfiguredTemplateTypes } = notificationTemplateServiceTemplateTypeMismatches(input);
  const problems: string[] = [];

  if (unknownTemplateTypes.length) {
    problems.push(`message factories without a NotificationTemplateTypeInfo: ${unknownTemplateTypes.join(', ')}`);
  }

  if (unconfiguredTemplateTypes.length) {
    problems.push(`NotificationTemplateTypeInfo without a message factory: ${unconfiguredTemplateTypes.join(', ')}`);
  }

  if (problems.length) {
    throw new Error(`assertNotificationTemplateServiceTemplateTypes(): the NotificationTemplateService does not match the app's NotificationTemplateTypeInfo record. Found ${problems.join('; ')}.`);
  }
}
