import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordApi } from './discord.api';
import { DiscordServiceConfig } from './discord.config';
import { appDiscordModuleMetadata, discordServiceConfigFactory } from './discord.module';

describe('appDiscordModuleMetadata()', () => {
  it('should provide the DiscordApi with the default config factory', () => {
    const metadata = appDiscordModuleMetadata({});

    expect(metadata.imports).toEqual([ConfigModule]);
    expect(metadata.exports).toEqual([DiscordApi]);

    const configProvider = metadata.providers?.[0] as { provide: unknown; inject: unknown[]; useFactory: unknown };

    expect(configProvider.provide).toBe(DiscordServiceConfig);
    expect(configProvider.inject).toEqual([ConfigService]);
    expect(configProvider.useFactory).toBe(discordServiceConfigFactory);
    expect(metadata.providers?.[1]).toBe(DiscordApi);
  });

  it('should use the config factory provided by the app', () => {
    const appFactory = () => ({ discord: { botToken: 'app-token', autoLogin: false } }) as DiscordServiceConfig;

    const metadata = appDiscordModuleMetadata({ discordServiceConfigFactory: appFactory });
    const configProvider = metadata.providers?.[0] as { useFactory: unknown };

    expect(configProvider.useFactory).toBe(appFactory);
  });

  it('should append the app imports, exports, and providers', () => {
    class TestModule {}
    class TestProvider {}

    const metadata = appDiscordModuleMetadata({
      imports: [TestModule],
      exports: [TestProvider],
      providers: [TestProvider]
    });

    expect(metadata.imports).toEqual([ConfigModule, TestModule]);
    expect(metadata.exports).toEqual([DiscordApi, TestProvider]);
    expect(metadata.providers?.[2]).toBe(TestProvider);
  });
});
