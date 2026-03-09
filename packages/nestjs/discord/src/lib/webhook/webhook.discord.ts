import { type HandlerBindAccessor, type HandlerMappedSetFunction, type Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import { InteractionType, type Interaction } from 'discord.js';

/**
 * Discord interaction type numeric key, used for handler dispatch.
 */
export type DiscordInteractionType = InteractionType;

/**
 * An untyped Discord interaction received via webhook.
 */
export type UntypedDiscordInteraction = Interaction;

/**
 * A typed Discord interaction, narrowed from the base Interaction type.
 *
 * @example
 * ```ts
 * const interaction: DiscordWebhookInteraction<ChatInputCommandInteraction> = discordWebhookInteraction(rawInteraction);
 * ```
 */
export type DiscordWebhookInteraction<T extends Interaction = Interaction> = T;

/**
 * Casts an untyped Discord interaction to a typed one.
 *
 * @param interaction - the raw interaction to cast
 */
export function discordWebhookInteraction<T extends Interaction = Interaction>(interaction: UntypedDiscordInteraction): DiscordWebhookInteraction<T> {
  return interaction as DiscordWebhookInteraction<T>;
}

// MARK: Handler
export type DiscordInteractionHandler = Handler<UntypedDiscordInteraction, DiscordInteractionType>;
export const discordInteractionHandlerFactory = handlerFactory<UntypedDiscordInteraction, DiscordInteractionType>((x) => x.type);

export type DiscordHandlerMappedSetFunction<T extends Interaction = Interaction> = HandlerMappedSetFunction<DiscordWebhookInteraction<T>>;

/**
 * Configurer for Discord interaction handlers.
 *
 * Handlers are keyed on InteractionType. Use discord.js type guards
 * (e.g., interaction.isChatInputCommand(), interaction.isButton()) within
 * your handler callback for sub-type refinement.
 */
export interface DiscordInteractionHandlerConfigurer extends HandlerBindAccessor<UntypedDiscordInteraction, DiscordInteractionType> {
  /**
   * Handles application commands (slash commands + context menu commands).
   *
   * Use interaction.isChatInputCommand() or interaction.isContextMenuCommand() to narrow the type within your handler.
   */
  readonly handleApplicationCommand: DiscordHandlerMappedSetFunction;
  /**
   * Handles message component interactions (buttons + select menus).
   *
   * Use interaction.isButton() or interaction.isStringSelectMenu() to narrow the type within your handler.
   */
  readonly handleMessageComponent: DiscordHandlerMappedSetFunction;
  /**
   * Handles modal submit interactions.
   */
  readonly handleModalSubmit: DiscordHandlerMappedSetFunction;
  /**
   * Handles autocomplete interactions for slash command options.
   */
  readonly handleAutocomplete: DiscordHandlerMappedSetFunction;
}

export const discordInteractionHandlerConfigurerFactory = handlerConfigurerFactory<DiscordInteractionHandlerConfigurer, UntypedDiscordInteraction, DiscordInteractionType>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedDiscordInteraction, DiscordInteractionType>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<DiscordWebhookInteraction<any>, any, DiscordInteractionType>(accessor, discordWebhookInteraction);

    const configurer: DiscordInteractionHandlerConfigurer = {
      ...accessor,
      handleApplicationCommand: fnWithKey(InteractionType.ApplicationCommand),
      handleMessageComponent: fnWithKey(InteractionType.MessageComponent),
      handleModalSubmit: fnWithKey(InteractionType.ModalSubmit),
      handleAutocomplete: fnWithKey(InteractionType.ApplicationCommandAutocomplete)
    };

    return configurer;
  }
});
