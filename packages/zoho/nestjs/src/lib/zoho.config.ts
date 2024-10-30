import { ZohoConfig } from '@dereekb/zoho';
import { ConfigService } from '@nestjs/config';

export const zohoApiUrlConfigKey = 'ZOHO_API_URL';

/**
 * Reads the ZohoConfig config from the ConfigService.
 *
 * @param configService
 * @param prefix
 */
export function readZohoConfigFromConfigService(configService: ConfigService, servicePrefix?: string, assertValid = true): ZohoConfig {
  const servicePrefixString = servicePrefix ? `${servicePrefix}_` : '';
  const apiUrlConfigKey = `${servicePrefixString}${zohoApiUrlConfigKey}`;

  const config = {
    apiUrl: configService.get<string>(apiUrlConfigKey) ?? (configService.get<string>(zohoApiUrlConfigKey) as string)
  };

  if (assertValid) {
    if (!config.apiUrl) {
      throw new Error(`No Zoho API url or type specified for key "${apiUrlConfigKey}".`);
    }
  }

  return config;
}

export function assertValidZohoConfig(config: ZohoConfig, apiUrlConfigKey: string) {
  if (!config.apiUrl) {
    throw new Error(`No Zoho API url or type specified for key "${apiUrlConfigKey}".`);
  }
}
