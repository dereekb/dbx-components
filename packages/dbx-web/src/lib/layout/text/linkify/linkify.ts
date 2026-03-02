import type linkifyStr from 'linkify-string';

/**
 * The default linkify string type.
 */
export const DEFAULT_DBX_LINKIFY_STRING_TYPE: DbxLinkifyStringType = 'DEFAULT';

/**
 * Custom key used to identify a type of linkify string.
 *
 * I.E. how-to-section, product-description, etc.
 */
export type DbxLinkifyStringType = string;

/**
 * Customization options used by DbxLinkifyComponent.
 */
export type DbxLinkifyStringOptions = Parameters<typeof linkifyStr>[1];
