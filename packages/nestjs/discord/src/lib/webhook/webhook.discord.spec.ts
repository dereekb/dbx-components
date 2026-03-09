import { InteractionType } from 'discord.js';
import { discordInteractionHandlerFactory, discordInteractionHandlerConfigurerFactory, type UntypedDiscordInteraction } from './webhook.discord';

function mockInteraction(type: InteractionType): UntypedDiscordInteraction {
  return { type } as unknown as UntypedDiscordInteraction;
}

describe('discordInteractionHandlerFactory', () => {
  it('should create a handler', () => {
    const handler = discordInteractionHandlerFactory();
    expect(handler).toBeDefined();
  });

  it('should dispatch to the registered handler by interaction type', async () => {
    const handler = discordInteractionHandlerFactory();
    const handlerFn = vi.fn();

    handler.set(InteractionType.ApplicationCommand, handlerFn);

    const interaction = mockInteraction(InteractionType.ApplicationCommand);
    await handler(interaction);

    expect(handlerFn).toHaveBeenCalledWith(interaction);
  });

  it('should not call handler for a different interaction type', async () => {
    const handler = discordInteractionHandlerFactory();
    const handlerFn = vi.fn();

    handler.set(InteractionType.ApplicationCommand, handlerFn);

    const interaction = mockInteraction(InteractionType.ModalSubmit);
    const result = await handler(interaction);

    expect(handlerFn).not.toHaveBeenCalled();
    expect(result).toBeFalsy();
  });
});

describe('discordInteractionHandlerConfigurerFactory', () => {
  it('should create a configurer from a handler', () => {
    const handler = discordInteractionHandlerFactory();
    const configure = discordInteractionHandlerConfigurerFactory(handler);
    expect(configure).toBeDefined();
  });

  describe('handleApplicationCommand', () => {
    it('should register and dispatch application command handlers', async () => {
      const handler = discordInteractionHandlerFactory();
      const configure = discordInteractionHandlerConfigurerFactory(handler);
      const handlerFn = vi.fn();

      configure({}, (c) => c.handleApplicationCommand(handlerFn));

      const interaction = mockInteraction(InteractionType.ApplicationCommand);
      await handler(interaction);

      expect(handlerFn).toHaveBeenCalled();
    });
  });

  describe('handleMessageComponent', () => {
    it('should register and dispatch message component handlers', async () => {
      const handler = discordInteractionHandlerFactory();
      const configure = discordInteractionHandlerConfigurerFactory(handler);
      const handlerFn = vi.fn();

      configure({}, (c) => c.handleMessageComponent(handlerFn));

      const interaction = mockInteraction(InteractionType.MessageComponent);
      await handler(interaction);

      expect(handlerFn).toHaveBeenCalled();
    });
  });

  describe('handleModalSubmit', () => {
    it('should register and dispatch modal submit handlers', async () => {
      const handler = discordInteractionHandlerFactory();
      const configure = discordInteractionHandlerConfigurerFactory(handler);
      const handlerFn = vi.fn();

      configure({}, (c) => c.handleModalSubmit(handlerFn));

      const interaction = mockInteraction(InteractionType.ModalSubmit);
      await handler(interaction);

      expect(handlerFn).toHaveBeenCalled();
    });
  });

  describe('handleAutocomplete', () => {
    it('should register and dispatch autocomplete handlers', async () => {
      const handler = discordInteractionHandlerFactory();
      const configure = discordInteractionHandlerConfigurerFactory(handler);
      const handlerFn = vi.fn();

      configure({}, (c) => c.handleAutocomplete(handlerFn));

      const interaction = mockInteraction(InteractionType.ApplicationCommandAutocomplete);
      await handler(interaction);

      expect(handlerFn).toHaveBeenCalled();
    });
  });

  it('should dispatch to the correct handler when multiple are registered', async () => {
    const handler = discordInteractionHandlerFactory();
    const configure = discordInteractionHandlerConfigurerFactory(handler);

    const commandFn = vi.fn();
    const modalFn = vi.fn();

    configure({}, (c) => {
      c.handleApplicationCommand(commandFn);
      c.handleModalSubmit(modalFn);
    });

    const modalInteraction = mockInteraction(InteractionType.ModalSubmit);
    await handler(modalInteraction);

    expect(commandFn).not.toHaveBeenCalled();
    expect(modalFn).toHaveBeenCalledWith(modalInteraction);
  });
});
