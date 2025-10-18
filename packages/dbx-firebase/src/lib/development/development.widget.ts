import { type DbxWidgetEntry } from '@dereekb/dbx-web';
import { type LabelRef } from '@dereekb/util';

export interface DbxFirebaseDevelopmentWidgetEntry extends Readonly<LabelRef> {
  /**
   * Widget entry for this provider.
   */
  readonly widget: DbxWidgetEntry;
}
