import { type Maybe } from '@dereekb/util';

export type DbxSectionHeaderHType = 1 | 2 | 3 | 4 | 5;

export interface DbxSectionHeaderConfig {
  /**
   * Header sizing
   */
  readonly h?: Maybe<DbxSectionHeaderHType>;
  /**
   * Whether or not to pad the header so it is inline with a dbx-content-container
   */
  readonly paddedHeader?: Maybe<boolean>;
  /**
   * The header text
   */
  readonly header?: Maybe<string>;
  /**
   * Whether or not the header should be the only content in the section.
   */
  readonly onlyHeader?: Maybe<boolean>;
  /**
   * The icon to show.
   */
  readonly icon?: Maybe<string>;
  /**
   * The hint text to show.
   */
  readonly hint?: Maybe<string>;
  /**
   * Whether or not the hint should be shown inline with the header.
   */
  readonly hintInline?: Maybe<boolean>;
}
