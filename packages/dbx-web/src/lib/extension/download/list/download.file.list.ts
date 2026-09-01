import { type Maybe } from '@dereekb/util';
import { type DbxDownloadBlobButtonConfig } from '../blob/download.blob.button.component';

/**
 * How a file list item renders its details date.
 *
 * `'distance'` renders the date relative to now ("3 hours ago", "in 2 days"), and `'distance-past'` does
 * the same for a date that describes something that ALREADY HAPPENED — clamping it to now so it can never
 * read as the future. The remaining values are passed through to Angular's DatePipe.
 *
 * Prefer `'distance-past'` for an uploaded-at or created-at date. A stored timestamp lands marginally
 * ahead of the client more often than it looks: a clock a second out will do it, and so will a value
 * stored as whole Unix seconds, which rounds UP. Under `'distance'` such a date reads "in less than a
 * minute", which for something that already happened is nonsense.
 */
export type DbxFileListItemDetailsDateStyle = 'distance' | 'distance-past' | 'short' | 'medium' | 'long';

/**
 * Default details date style used by a file list item.
 */
export const DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_DATE_STYLE: DbxFileListItemDetailsDateStyle = 'short';

/**
 * Default css class applied to a file list item's details line.
 */
export const DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_CLASS = 'dbx-hint';

/**
 * Configuration for the {@link DbxFileListItemComponent}.
 */
export interface DbxFileListItemComponentConfig {
  /**
   * The file's name. Shown on the item's first line.
   */
  readonly name?: Maybe<string>;
  /**
   * Optional leading icon.
   *
   * Leave undefined when the item is rendered inside a dbx-list, as the list renders the
   * item's own icon itself.
   */
  readonly icon?: Maybe<string>;
  /**
   * Static text for the second line. Rendered before {@link detailsDate} when both are set.
   */
  readonly details?: Maybe<string>;
  /**
   * Date for the second line.
   */
  readonly detailsDate?: Maybe<Date>;
  /**
   * How {@link detailsDate} is rendered. Defaults to {@link DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_DATE_STYLE}.
   */
  readonly detailsDateStyle?: Maybe<DbxFileListItemDetailsDateStyle>;
  /**
   * Css class applied to the second line. Defaults to {@link DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_CLASS}.
   *
   * Use `'dbx-warn'` to mark a file that failed.
   */
  readonly detailsClass?: Maybe<string>;
}

/**
 * A single row of a {@link DbxFileListComponent}.
 */
export interface DbxFileListEntry<T = unknown> extends DbxFileListItemComponentConfig {
  /**
   * Stable key used to track the entry across updates.
   */
  readonly key: string;
  /**
   * Configuration for the row's download button. The button is not rendered when this is not set.
   */
  readonly download?: Maybe<DbxDownloadBlobButtonConfig>;
  /**
   * Arbitrary value the entry was derived from.
   */
  readonly data?: T;
}

/**
 * Configuration for the {@link DbxFileListComponent}.
 */
export interface DbxFileListComponentConfig<T = unknown> {
  /**
   * The entries to list.
   */
  readonly entries?: Maybe<DbxFileListEntry<T>[]>;
  /**
   * What is shown in place of the list while it has no entries. Nothing is shown when this is not set.
   */
  readonly emptyText?: Maybe<string>;
}
