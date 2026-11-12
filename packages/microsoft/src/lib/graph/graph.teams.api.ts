import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type MicrosoftGraphQuery, type MicrosoftGraphRequestInput } from './graph.api';
import { type MicrosoftGraphItemBody } from './graph.type';

/**
 * Teams answers sends at most once per second per chat or channel, and once per second per user.
 *
 * @see https://learn.microsoft.com/en-us/graph/throttling-limits#microsoft-teams-service-limits
 */
export const MICROSOFT_GRAPH_TEAMS_SEND_MIN_INTERVAL_MS = 1000;

/**
 * The largest `$top` a chat list or chat message list takes.
 */
export const MICROSOFT_GRAPH_TEAMS_MAX_TOP = 50;

/**
 * The scope reading channel messages needs. It requires admin consent; no user-consentable preset carries it.
 */
export const MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE = 'ChannelMessage.Read.All';

/**
 * The scope deleting a channel message needs. It requires admin consent.
 */
export const MICROSOFT_GRAPH_CHANNEL_MESSAGE_WRITE_SCOPE = 'ChannelMessage.ReadWrite';

export type MicrosoftGraphChatType = 'oneOnOne' | 'group' | 'meeting' | 'unknownFutureValue';

/**
 * The subset of a chat `conversationMember` this package reads.
 */
export interface MicrosoftGraphChatMember {
  readonly displayName?: Maybe<string>;
  readonly email?: Maybe<string>;
  readonly userId?: Maybe<string>;
}

/**
 * The subset of a Graph `chat` this package reads.
 */
export interface MicrosoftGraphChat {
  readonly id: string;
  readonly topic?: Maybe<string>;
  readonly chatType?: Maybe<MicrosoftGraphChatType>;
  readonly lastUpdatedDateTime?: Maybe<ISO8601DateString>;
  readonly webUrl?: Maybe<string>;
  readonly members?: Maybe<MicrosoftGraphChatMember[]>;
}

// MARK: Paths
function enc(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Returns the messages path of a chat.
 *
 * @param chatId - The chat id.
 * @returns E.g. `/chats/19:abc@thread.v2/messages`.
 */
export function microsoftGraphChatMessagesPath(chatId: string): string {
  return `/chats/${enc(chatId)}/messages`;
}

/**
 * Returns the messages path of a channel.
 *
 * @param teamId - The team id.
 * @param channelId - The channel id.
 * @returns E.g. `/teams/{team}/channels/{channel}/messages`.
 */
export function microsoftGraphChannelMessagesPath(teamId: string, channelId: string): string {
  return `/teams/${enc(teamId)}/channels/${enc(channelId)}/messages`;
}

// MARK: Read requests
/**
 * Builds the GET of the teams the user belongs to (`Team.ReadBasic.All`).
 *
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-list-joinedteams
 */
export function microsoftGraphJoinedTeamsRequest(): MicrosoftGraphRequestInput {
  return { method: 'GET', path: '/me/joinedTeams', query: { $select: 'id,displayName,description' } };
}

/**
 * Builds the GET of a team's channels (`Channel.ReadBasic.All`).
 *
 * @param teamId - The team id.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/channel-list
 */
export function microsoftGraphTeamChannelsRequest(teamId: string): MicrosoftGraphRequestInput {
  return { method: 'GET', path: `/teams/${enc(teamId)}/channels`, query: { $select: 'id,displayName,description,membershipType' } };
}

/**
 * Builds the GET of the user's chats with their members expanded, 50 per page (`Chat.ReadBasic` /
 * `Chat.Read`).
 *
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/chat-list
 */
export function microsoftGraphChatsRequest(): MicrosoftGraphRequestInput {
  return { method: 'GET', path: '/me/chats', query: { $expand: 'members', $top: MICROSOFT_GRAPH_TEAMS_MAX_TOP } };
}

export interface MicrosoftGraphChatMessagesInput {
  readonly chatId: string;
  /**
   * Only messages changed after this instant.
   */
  readonly since?: Maybe<ISO8601DateString>;
  readonly top?: Maybe<number>;
}

/**
 * Builds the GET of a chat's messages, newest change first. A `since` filter is on `lastModifiedDateTime`, the
 * property the list is ordered by, as Graph requires.
 *
 * @param input - The chat, window and page size.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/chat-list-messages
 */
export function microsoftGraphChatMessagesRequest(input: MicrosoftGraphChatMessagesInput): MicrosoftGraphRequestInput {
  const query: MicrosoftGraphQuery = { $top: Math.min(input.top ?? MICROSOFT_GRAPH_TEAMS_MAX_TOP, MICROSOFT_GRAPH_TEAMS_MAX_TOP), $orderby: 'lastModifiedDateTime desc', $filter: input.since ? `lastModifiedDateTime gt ${input.since}` : undefined };
  return { method: 'GET', path: microsoftGraphChatMessagesPath(input.chatId), query };
}

/**
 * Builds the GET of a user's presence (`Presence.Read`, or `Presence.Read.All` for another user).
 *
 * @param userId - Another user's id or UPN. The signed-in user when absent.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/presence-get
 */
export function microsoftGraphPresenceRequest(userId?: Maybe<string>): MicrosoftGraphRequestInput {
  return { method: 'GET', path: userId ? `/users/${enc(userId)}/presence` : '/me/presence' };
}

/**
 * Builds the GET of a channel's files folder, a drive item whose `parentReference.driveId` is the team's
 * SharePoint library.
 *
 * @param teamId - The team id.
 * @param channelId - The channel id.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/channel-get-filesfolder
 */
export function microsoftGraphChannelFilesFolderRequest(teamId: string, channelId: string): MicrosoftGraphRequestInput {
  return { method: 'GET', path: `/teams/${enc(teamId)}/channels/${enc(channelId)}/filesFolder` };
}

/**
 * Builds the GET of a channel's messages. Admin-consent only: needs {@link MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE}.
 *
 * @param input - The team, channel, page size and whether to expand replies.
 * @param input.teamId - The team id.
 * @param input.channelId - The channel id.
 * @param input.top - Messages per page.
 * @param input.replies - Whether to expand each message's replies.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/channel-list-messages
 */
export function microsoftGraphChannelMessagesRequest(input: { readonly teamId: string; readonly channelId: string; readonly top?: Maybe<number>; readonly replies?: Maybe<boolean> }): MicrosoftGraphRequestInput {
  return { method: 'GET', path: microsoftGraphChannelMessagesPath(input.teamId, input.channelId), query: { $top: Math.min(input.top ?? MICROSOFT_GRAPH_TEAMS_MAX_TOP, MICROSOFT_GRAPH_TEAMS_MAX_TOP), $expand: input.replies ? 'replies' : undefined } };
}

// MARK: Write requests
/**
 * Builds the POST that sends a chat message (Graph answers 201 with it). `ChatMessage.Send` / `Chat.ReadWrite`.
 *
 * @param input - The chat and body.
 * @param input.chatId - The chat id.
 * @param input.body - The message body.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/chat-post-messages
 */
export function microsoftGraphSendChatMessageRequest(input: { readonly chatId: string; readonly body: MicrosoftGraphItemBody }): MicrosoftGraphRequestInput {
  return { method: 'POST', path: microsoftGraphChatMessagesPath(input.chatId), body: { body: input.body } };
}

/**
 * Builds the POST that soft-deletes one of the user's chat messages, or restores it with `undo`
 * (Graph answers 204). Uses the `/me/chats` path, which works although only `/users/{id}/chats` is documented.
 *
 * @param input - The chat, message and whether to undo.
 * @param input.chatId - The chat id.
 * @param input.messageId - The message id.
 * @param input.undo - Whether to restore the message (`undoSoftDelete`).
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/chatmessage-softdelete
 * @see https://learn.microsoft.com/en-us/graph/api/chatmessage-undosoftdelete
 */
export function microsoftGraphSoftDeleteChatMessageRequest(input: { readonly chatId: string; readonly messageId: string; readonly undo?: Maybe<boolean> }): MicrosoftGraphRequestInput {
  return { method: 'POST', path: `/me/chats/${enc(input.chatId)}/messages/${enc(input.messageId)}/${input.undo ? 'undoSoftDelete' : 'softDelete'}` };
}

/**
 * Builds the POST that posts to a channel, or replies to a channel message when `replyToId` is set
 * (Graph answers 201). `ChannelMessage.Send`.
 *
 * @param input - The team, channel, parent message and body.
 * @param input.teamId - The team id.
 * @param input.channelId - The channel id.
 * @param input.replyToId - The message being replied to.
 * @param input.body - The message body.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/channel-post-messages
 * @see https://learn.microsoft.com/en-us/graph/api/chatmessage-post-replies
 */
export function microsoftGraphSendChannelMessageRequest(input: { readonly teamId: string; readonly channelId: string; readonly replyToId?: Maybe<string>; readonly body: MicrosoftGraphItemBody }): MicrosoftGraphRequestInput {
  const path = microsoftGraphChannelMessagesPath(input.teamId, input.channelId);
  return { method: 'POST', path: input.replyToId ? `${path}/${enc(input.replyToId)}/replies` : path, body: { body: input.body } };
}

/**
 * Builds the POST that soft-deletes a channel message. Admin-consent only: needs
 * {@link MICROSOFT_GRAPH_CHANNEL_MESSAGE_WRITE_SCOPE}, even for the user's own post.
 *
 * @param input - The team, channel and message.
 * @param input.teamId - The team id.
 * @param input.channelId - The channel id.
 * @param input.messageId - The message id.
 * @returns The request.
 */
export function microsoftGraphSoftDeleteChannelMessageRequest(input: { readonly teamId: string; readonly channelId: string; readonly messageId: string }): MicrosoftGraphRequestInput {
  return { method: 'POST', path: `${microsoftGraphChannelMessagesPath(input.teamId, input.channelId)}/${enc(input.messageId)}/softDelete` };
}

// MARK: Chat matching
export interface MicrosoftGraphChatFilter {
  /**
   * Names or addresses that must each match a member (display name or email, case-insensitive substring).
   */
  readonly withNames?: Maybe<readonly string[]>;
  /**
   * A case-insensitive substring of the chat's topic.
   */
  readonly topic?: Maybe<string>;
  readonly chatType?: Maybe<MicrosoftGraphChatType>;
}

/**
 * Returns whether a chat passes the filter. Matching is local, on chats read with `$expand=members`.
 *
 * @param chat - The chat with its members.
 * @param filter - The names, topic and type.
 * @returns Whether it matches.
 */
export function microsoftGraphChatMatches(chat: MicrosoftGraphChat, filter: MicrosoftGraphChatFilter): boolean {
  const members = (chat.members ?? []).map((x) => `${x.displayName ?? ''}\n${x.email ?? ''}`.toLowerCase());
  const namesMatch = (filter.withNames ?? []).every((name) => {
    const wanted = name.trim().toLowerCase();
    return wanted.length === 0 || members.some((x) => x.includes(wanted));
  });
  const topicMatches = !filter.topic || (chat.topic ?? '').toLowerCase().includes(filter.topic.toLowerCase());
  const typeMatches = !filter.chatType || chat.chatType === filter.chatType;
  return namesMatch && topicMatches && typeMatches;
}
