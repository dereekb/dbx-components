import { GatewayIntentBits } from 'discord.js';
import { discordDefaultClientOptions, discordClientOptionsWithIntents } from './discord.util';
import { DISCORD_DEFAULT_INTENTS } from './discord.config';

describe('discordDefaultClientOptions()', () => {
  it('should return options with the default intents', () => {
    const options = discordDefaultClientOptions();

    expect(options.intents).toBeDefined();
    expect(options.intents).toEqual(DISCORD_DEFAULT_INTENTS);
  });
});

describe('discordClientOptionsWithIntents()', () => {
  it('should return options with defaults plus additional intents', () => {
    const additional = [GatewayIntentBits.DirectMessages];
    const options = discordClientOptionsWithIntents(additional);

    expect(options.intents).toBeDefined();
    expect(options.intents).toEqual([...DISCORD_DEFAULT_INTENTS, GatewayIntentBits.DirectMessages]);
  });

  it('should return only defaults when given an empty array', () => {
    const options = discordClientOptionsWithIntents([]);

    expect(options.intents).toEqual(DISCORD_DEFAULT_INTENTS);
  });
});
