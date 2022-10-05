import { DbxWidgetEntry } from '@dereekb/dbx-web';

export interface DbxFirebaseDevelopmentWidgetEntry {
  readonly label: string;
  /**
   * Widget entry for this provider.
   */
  readonly widget: DbxWidgetEntry;
}
