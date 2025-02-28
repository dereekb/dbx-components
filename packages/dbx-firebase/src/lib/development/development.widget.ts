import { DbxWidgetEntry } from '@dereekb/dbx-web';
import { LabelRef } from '@dereekb/util';

export interface DbxFirebaseDevelopmentWidgetEntry extends Readonly<LabelRef> {
  /**
   * Widget entry for this provider.
   */
  readonly widget: DbxWidgetEntry;
}
