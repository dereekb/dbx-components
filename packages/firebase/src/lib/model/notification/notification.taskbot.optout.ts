/**
 * @module notification.taskbot.optout
 *
 * The owner's view of a {@link NotificationTaskBot}'s opt-outs.
 *
 * The owner only ever sees the script groups their bot has opt-out-able entries in, never the entries, the script
 * types, or the groups they can't opt out of. The update API validates against this same list.
 */
import { type Maybe } from '@dereekb/util';
import { earliestDate } from '@dereekb/date';
import { type NotificationTaskBotScriptGroupKey } from './notification.id';
import { type NotificationTaskBot } from './notification.taskbot';
import { type AppNotificationTaskBotScriptConfigService, type NotificationTaskBotScriptGroup } from './notification.taskbot.script';
import { compareNotificationTemplateTypeInfoGroups } from './notification.settings';

/**
 * A script group the bot's owner can opt out of, as shown to the owner.
 */
export interface NotificationTaskBotOwnerOptOutGroup extends NotificationTaskBotScriptGroup {
  /**
   * When the owner opted out of the group. Set means the group is opted out, the same rule as on entries.
   *
   * The earliest `oat` among the group's opt-out-able entries; unset when none of them is opted out.
   */
  readonly optOutAt?: Maybe<Date>;
}

/**
 * Input for {@link notificationTaskBotOwnerOptOutGroups}.
 */
export interface NotificationTaskBotOwnerOptOutGroupsInput {
  /**
   * The bot. Only its entries are read.
   */
  readonly bot: Maybe<Pick<NotificationTaskBot, 'e'>>;
  /**
   * The app's script registry, used to resolve each entry's opt-out group.
   */
  readonly scriptConfigService: Pick<AppNotificationTaskBotScriptConfigService, 'optOutGroupKeyForScriptType' | 'optOutGroupForKey'>;
}

/**
 * Builds the owner's view of a bot's opt-outs: one item per group that has an entry whose script allows owner opt-out,
 * sorted like notification template type groups (`sortOrder`, then name).
 *
 * @param input - The bot and the script registry.
 * @returns The groups the owner can opt out of, with their opt-out state.
 *
 * @example
 * ```ts
 * const groups = notificationTaskBotOwnerOptOutGroups({ bot, scriptConfigService });
 * const optedOut = groups.filter((x) => x.optOutAt != null);
 * ```
 */
export function notificationTaskBotOwnerOptOutGroups(input: NotificationTaskBotOwnerOptOutGroupsInput): NotificationTaskBotOwnerOptOutGroup[] {
  const { bot, scriptConfigService } = input;
  const optOutAtByGroupKey = new Map<NotificationTaskBotScriptGroupKey, Maybe<Date>>();

  bot?.e.forEach((entry) => {
    const groupKey = scriptConfigService.optOutGroupKeyForScriptType(entry.t);

    if (groupKey != null) {
      optOutAtByGroupKey.set(groupKey, earliestDate([optOutAtByGroupKey.get(groupKey), entry.oat]));
    }
  });

  const groups: NotificationTaskBotOwnerOptOutGroup[] = [];

  optOutAtByGroupKey.forEach((optOutAt, groupKey) => {
    const group = scriptConfigService.optOutGroupForKey(groupKey);

    if (group != null) {
      groups.push(optOutAt == null ? { ...group } : { ...group, optOutAt });
    }
  });

  return groups.sort(compareNotificationTemplateTypeInfoGroups);
}
