import { type Maybe } from '@dereekb/util';
import { type TrelloActionId, type TrelloCardId, type TrelloMemberId } from '../trello.type';
import { type TrelloAction, type TrelloCommentCardActionData } from '../trello/trello.api.card.type';

/**
 * Identifies the author of actions — typically a bot — by member id, by the id of the app it posts through, or by a
 * sign-off pattern in its comment text. Any one match counts.
 */
export interface TrelloActionAuthorIdentity {
  readonly memberIds?: Maybe<readonly TrelloMemberId[]>;
  readonly appCreatorIds?: Maybe<readonly string[]>;
  /**
   * Matched against the comment text, for a bot that posts through a shared account and signs its comments.
   */
  readonly signoffPattern?: Maybe<RegExp>;
}

/**
 * Whether an action was authored by the given identity.
 *
 * @param action - The action, typically a `commentCard`.
 * @param identity - Who to test for.
 * @returns `true` when the action's member, app or comment sign-off matches the identity.
 */
export function isTrelloActionAuthoredBy(action: Maybe<TrelloAction<unknown>>, identity: TrelloActionAuthorIdentity): boolean {
  let result = false;

  if (action != null) {
    const memberId = action.idMemberCreator;
    const appCreatorId = action.appCreator?.id;
    const text = (action.data as Maybe<Partial<TrelloCommentCardActionData>>)?.text ?? '';
    result = (memberId != null && (identity.memberIds ?? []).includes(memberId)) || (appCreatorId != null && (identity.appCreatorIds ?? []).includes(appCreatorId)) || (identity.signoffPattern?.test(text) ?? false);
  }

  return result;
}

/**
 * One comment that `@`-mentions the member {@link findTrelloMentions} looked for.
 */
export interface TrelloMention {
  readonly actionId: TrelloActionId;
  readonly cardId: Maybe<TrelloCardId>;
  readonly date: string;
  readonly authorId: TrelloMemberId;
  readonly authorUsername: Maybe<string>;
  readonly text: string;
}

/**
 * Input for {@link findTrelloMentions}.
 */
export interface FindTrelloMentionsInput {
  /**
   * Comment actions to scan, in any order. Non-`commentCard` actions are ignored.
   */
  readonly actions: readonly TrelloAction<unknown>[];
  /**
   * The username whose `@`-mentions to find, with or without the leading `@`. Matched case-insensitively and only as a
   * whole handle, so `@bot` does not match `@bottle` or `me@bot.com`.
   */
  readonly username: string;
  /**
   * Authors whose comments never count — usually the mentioned member itself, so the bot's own replies (which may
   * quote the mention) are skipped.
   */
  readonly exclude?: Maybe<TrelloActionAuthorIdentity>;
  /**
   * Only return mentions newer than this action (the `newestMentionId` of the previous call).
   */
  readonly afterActionId?: Maybe<TrelloActionId>;
}

/**
 * The result of {@link findTrelloMentions}.
 */
export interface FindTrelloMentionsResult {
  /**
   * The mentions, oldest first.
   */
  readonly mentions: readonly TrelloMention[];
  /**
   * The id of the newest mention returned, or the input `afterActionId` when there were none. Save it and pass it as
   * `afterActionId` next time.
   */
  readonly newestMentionId: Maybe<TrelloActionId>;
}

/**
 * Builds the regex that matches an `@username` handle as a whole word.
 *
 * @param username - The username, with or without the `@`.
 * @returns The matcher.
 */
export function trelloMentionPattern(username: string): RegExp {
  const handle = username.trim().replace(/^@/, '');
  const escaped = handle.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`(^|[^A-Za-z0-9_@.])@${escaped}(?![A-Za-z0-9_])`, 'i');
}

/**
 * Finds the comments that `@`-mention a member, skipping comments by the excluded identity and anything at or before
 * `afterActionId`.
 *
 * Trello action ids are ObjectIds, whose hex order is creation order, so "newer than" compares ids; actions are
 * ordered by date first so a mixed batch is scanned chronologically.
 *
 * @param input - The actions, the username to look for, who to exclude, and the previous watermark.
 * @returns The mentions, oldest first, and the next watermark.
 */
export function findTrelloMentions(input: FindTrelloMentionsInput): FindTrelloMentionsResult {
  const { username, exclude, afterActionId } = input;
  const mentions: TrelloMention[] = [];
  let newestMentionId: Maybe<TrelloActionId> = afterActionId ?? null;

  if (username.trim().replace(/^@/, '').length > 0) {
    const pattern = trelloMentionPattern(username);
    const ordered = [...input.actions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id));

    for (const action of ordered) {
      const data = action.data as Maybe<Partial<TrelloCommentCardActionData>>;
      const text = (data?.text ?? '').trim();
      const isNew = afterActionId == null || action.id > afterActionId;

      if (action.type === 'commentCard' && isNew && text.length > 0 && pattern.test(text) && !(exclude != null && isTrelloActionAuthoredBy(action, exclude))) {
        mentions.push({ actionId: action.id, cardId: data?.card?.id ?? null, date: action.date, authorId: action.idMemberCreator, authorUsername: action.memberCreator?.username ?? null, text });
        newestMentionId = action.id;
      }
    }
  }

  return { mentions, newestMentionId };
}
