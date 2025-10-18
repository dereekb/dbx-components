import { type ZohoConfig, type ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { type ConfigService } from '@nestjs/config';

export const ZOHO_API_URL_CONFIG_KEY = 'API_URL';

export interface ZohoConfigServiceReaderConfig {
  readonly configService: ConfigService;
  readonly serviceAccessTokenKey: ZohoServiceAccessTokenKey;
}

/**
 * Reads a config value from the ConfigService for the input key.
 *
 * @param input
 */
export type ZohoConfigServiceReaderFunction = (configKey: string) => string;

/**
 * Creates a new ZohoConfigServiceReaderFunction that reads from the input ConfigService.
 * @param input
 */
export function zohoConfigServiceReaderFunction(input: ZohoConfigServiceReaderConfig): ZohoConfigServiceReaderFunction;
export function zohoConfigServiceReaderFunction(serviceAccessTokenKey: ZohoServiceAccessTokenKey, configService: ConfigService): ZohoConfigServiceReaderFunction;
export function zohoConfigServiceReaderFunction(inputOrKey: ZohoServiceAccessTokenKey | ZohoConfigServiceReaderConfig, inputConfigService?: ConfigService): ZohoConfigServiceReaderFunction {
  let configService: ConfigService;
  let serviceAccessTokenKey: ZohoServiceAccessTokenKey;

  if (typeof inputOrKey === 'string') {
    serviceAccessTokenKey = inputOrKey;
    configService = inputConfigService!;
  } else {
    configService = inputOrKey.configService;
    serviceAccessTokenKey = inputOrKey.serviceAccessTokenKey;
  }

  const baseServicePrefix = 'ZOHO_';
  const servicePrefix = serviceAccessTokenKey.toUpperCase(); // "RECRUIT"
  const servicePrefixString = `${baseServicePrefix}${servicePrefix}_`; // "ZOHO_RECRUIT_"

  return (key: string): string => {
    const baseConfigKey = `${baseServicePrefix}${key}`; // "ZOHO_ACCOUNTS_URL"
    const serviceSpecificConfigKey = `${servicePrefixString}${key}`; // "ZOHO_RECRUIT_ACCOUNTS_URL"
    return configService.get<string>(serviceSpecificConfigKey) ?? (configService.get<string>(baseConfigKey) as string);
  };
}

/**
 * Reads the ZohoConfig config from the ConfigService.
 *
 * @param configService
 * @param prefix
 */
export function readZohoConfigFromConfigService(configService: ConfigService, servicePrefix?: string, assertValid = true): ZohoConfig {
  const servicePrefixString = servicePrefix ? `${servicePrefix}_` : '';
  const apiUrlConfigKey = `${servicePrefixString}${ZOHO_API_URL_CONFIG_KEY}`;

  const config = {
    apiUrl: configService.get<string>(apiUrlConfigKey) ?? (configService.get<string>(ZOHO_API_URL_CONFIG_KEY) as string)
  };

  if (assertValid) {
    if (!config.apiUrl) {
      throw new Error(`No Zoho API url or type specified for key "${apiUrlConfigKey}".`);
    }
  }

  return config;
}

export function assertValidZohoConfig(config: ZohoConfig) {
  if (!config.apiUrl) {
    throw new Error(`No Zoho API url or type specified.`);
  }
}
