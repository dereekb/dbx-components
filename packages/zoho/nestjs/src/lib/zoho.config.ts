import { ZohoConfig } from '@dereekb/zoho';
import { ConfigService } from '@nestjs/config';

export const zohoApiKeyConfigKey = 'ZOHO_API_KEY';
export const zohoApiUrlConfigKey = 'ZOHO_API_URL';

/**
 * Reads the ZohoConfig config from the ConfigService.
 *
 * @param configService
 * @param prefix
 */
export function readZohoConfigFromConfigService(configService: ConfigService, servicePrefix?: string, assertValid = true): ZohoConfig {
  const servicePrefixString = servicePrefix ? `${servicePrefix}_` : '';
  const apiKeyConfigKey = `${servicePrefixString}${zohoApiKeyConfigKey}`;
  const apiUrlConfigKey = `${servicePrefixString}${zohoApiKeyConfigKey}`;

  const config = {
    apiKey: configService.get<string>(apiKeyConfigKey) ?? (configService.get<string>(zohoApiKeyConfigKey) as string),
    apiUrl: configService.get<string>(apiUrlConfigKey) ?? (configService.get<string>(zohoApiUrlConfigKey) as string)
  };

  if (assertValid) {
    if (!config.apiKey) {
      throw new Error(`No Zoho API key specified for key "${apiKeyConfigKey}".`);
    } else if (!config.apiUrl) {
      throw new Error(`No Zoho API url or type specified for key "${apiUrlConfigKey}".`);
    }
  }

  return config;
}

export function assertValidZohoConfig(config: ZohoConfig, apiKeyConfigKey: string, apiUrlConfigKey: string) {
  if (!config.apiKey) {
    throw new Error(`No Zoho API key specified for key "${apiKeyConfigKey}".`);
  } else if (!config.apiUrl) {
    throw new Error(`No Zoho API url or type specified for key "${apiUrlConfigKey}".`);
  }
}
