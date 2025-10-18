import { type DbxValueAsListItem } from '@dereekb/dbx-web';
import { range } from '@dereekb/util';

export interface DocValue {
  name: string;
  icon: string;
}

export function makeDocValues(numberToLoadPerUpdate = 50) {
  return range(numberToLoadPerUpdate).map((x) => ({ icon: 'house', name: `${x}-${Math.random() * x}` }));
}

export type DocValueWithSelection = DbxValueAsListItem<DocValue>;
