import { type DbxValueAsListItem } from '@dereekb/dbx-web';
import { range } from '@dereekb/util';

export interface DocValue {
  name: string;
  icon: string;
}

const DOC_VALUE_ICONS = ['house', 'person', 'star', 'warning'];

/**
 * Creates an array of demo DocValue items for list component examples.
 *
 * @param numberToLoadPerUpdate - Number of items to generate (default: 50)
 * @returns An array of DocValue objects with name and icon
 */
export function makeDocValues(numberToLoadPerUpdate = 50) {
  return range(numberToLoadPerUpdate).map((x) => ({ icon: DOC_VALUE_ICONS[x % DOC_VALUE_ICONS.length], name: `${x}-${Math.random() * x}` }));
}

export type DocValueWithSelection = DbxValueAsListItem<DocValue>;
