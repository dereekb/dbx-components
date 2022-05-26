import { DbxValueAsListItem } from '@dereekb/dbx-web';

export interface DocValue {
  name: string;
  icon: string;
}

export type DocValueWithSelection = DbxValueAsListItem<DocValue>;
