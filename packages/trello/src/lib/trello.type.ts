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

export type TrelloApiUrl = typeof TRELLO_API_URL;
