/**
 * 24-character hex id used for boards, lists, cards, members, webhooks, etc.
 */
export type TrelloId = string;

export type TrelloBoardId = TrelloId;
export type TrelloListId = TrelloId;
export type TrelloCardId = TrelloId;
export type TrelloMemberId = TrelloId;
export type TrelloLabelId = TrelloId;
export type TrelloActionId = TrelloId;
export type TrelloChecklistId = TrelloId;
export type TrelloAttachmentId = TrelloId;
export type TrelloWebhookId = TrelloId;
export type TrelloOrganizationId = TrelloId;
export type TrelloEnterpriseId = TrelloId;

/**
 * Trello API key, exposed publicly as part of Power-Up configuration.
 */
export type TrelloApiKey = string;

/**
 * Trello user API token granted via the OAuth1 or `/1/authorize` flow.
 *
 * Treat as a secret — token grants the same access the user has consented to.
 */
export type TrelloApiToken = string;

/**
 * Application secret used to sign webhook requests for verification.
 *
 * Found on the same Power-Up admin page as the API key.
 */
export type TrelloAppSecret = string;

/**
 * Trello username (the slug portion of a profile URL).
 */
export type TrelloUsername = string;

/**
 * Trello API URL (versioned).
 */
export const TRELLO_API_URL = 'https://api.trello.com/1';

/**
 * Trello API URL (versioned) used for OAuth 2.0 bearer requests.
 *
 * Kept apart from {@link TRELLO_API_URL}, which the legacy key+token mode uses unchanged. Trello's OAuth
 * 2.0 guides call `https://trello.com/1` while the webhooks guide uses `https://api.trello.com/1`; the
 * latter is the default here, unverified against the live server, so flipping it is a one-constant change.
 */
export const TRELLO_OAUTH_API_URL = 'https://api.trello.com/1';

/**
 * An OAuth 2.0 access token Trello's (Atlassian's) authorization server issued for a member. Sent as
 * `Authorization: Bearer`.
 *
 * Treat as a secret.
 */
export type TrelloOAuthAccessTokenString = string;

export type TrelloApiUrl = typeof TRELLO_API_URL;
