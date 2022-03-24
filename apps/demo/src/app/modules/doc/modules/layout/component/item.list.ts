import { DbxValueListItem } from "@dereekb/dbx-web";

export interface DocValue {
  name: string;
  icon: string;
}

export type DocValueWithSelection = DocValue & Omit<DbxValueListItem<DocValue>, 'value'>;
