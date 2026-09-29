import { type DbxListTitleGroupData, type DbxListTitleGroupTitleDelegate, type DbxThemeColor, type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type TodoItemChip } from './todo.item.list';

/**
 * Section of the grouped To Do list a to do is listed under.
 *
 * - `action_needed` — urgent to dos, rendered with a colored tile. Always listed first.
 * - `suggestions` — nice-to-have to dos, rendered with a grey tile.
 */
export type TodoGroupItemGroup = 'action_needed' | 'suggestions';

export interface TodoGroupItemValue {
  readonly id: string;
  readonly group: TodoGroupItemGroup;
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
  /**
   * Tile color of an `action_needed` row. Defaults to notice.
   */
  readonly color?: Maybe<DbxThemeColor>;
  readonly chip?: Maybe<TodoItemChip>;
  /**
   * Whole-row click target.
   */
  readonly anchor: ClickableAnchor;
}

export type TodoGroupItemValueWithSelection = DbxValueAsListItem<TodoGroupItemValue>;

export interface TodoGroupItemGroupData extends DbxListTitleGroupData<TodoGroupItemGroup> {
  readonly sort: number;
}

const TODO_GROUP_ITEM_GROUP_DATA: Record<TodoGroupItemGroup, TodoGroupItemGroupData> = {
  action_needed: { value: 'action_needed', title: 'Action needed', sort: 0 },
  suggestions: { value: 'suggestions', title: 'Suggestions', sort: 1 }
};

/**
 * Groups the to dos by {@link TodoGroupItemValue.group}, keeping "Action needed" above "Suggestions".
 */
export const TODO_GROUP_ITEM_LIST_GROUP_DELEGATE: DbxListTitleGroupTitleDelegate<TodoGroupItemValue, TodoGroupItemGroup, TodoGroupItemGroupData> = {
  groupValueForItem: (item) => item.itemValue.group,
  dataForGroupValue: (value) => TODO_GROUP_ITEM_GROUP_DATA[value],
  sortGroupsByData: (a, b) => a.sort - b.sort
};

export interface MakeTodoGroupItemValuesConfig {
  /**
   * Number of courses in progress. The "Courses in progress" to do is only listed while it is above zero.
   */
  readonly coursesInProgress: number;
  /**
   * Invoked with the to do's id when its row is clicked.
   */
  readonly onClick: (id: string) => void;
}

/**
 * Builds the grouped To Do values, giving each item an `anchor.onClick` that fires `onClick(id)`.
 *
 * The "Courses in progress" detail line changes with {@link MakeTodoGroupItemValuesConfig.coursesInProgress} while its
 * id stays the same, which is why the list view keys each row by its content instead of its id.
 *
 * @param config - The course count and click handler.
 * @returns Anchored values ready for the list state.
 */
export function makeTodoGroupItemValues(config: MakeTodoGroupItemValuesConfig): TodoGroupItemValue[] {
  const { coursesInProgress, onClick } = config;
  const seeds: Omit<TodoGroupItemValue, 'anchor'>[] = [
    { id: 'waiver-expired', group: 'action_needed', icon: 'error', title: 'Studio waiver expired', detail: 'Sign a new waiver before your next hands-on session.', color: 'warn' },
    { id: 'membership-expiring', group: 'action_needed', icon: 'card_membership', title: 'Membership expiring', detail: 'Renew to keep your booked sessions.', chip: { text: 'Expires Oct 12', color: 'warn' } },
    { id: 'emergency-contact', group: 'action_needed', icon: 'contact_phone', title: 'Add an emergency contact', detail: 'Required for kiln and wheel workshops.' },
    { id: 'profile-picture', group: 'suggestions', icon: 'photo_camera', title: 'Add a profile picture', detail: 'Instructors will see your photo when you join a session.' },
    { id: 'class-preferences', group: 'suggestions', icon: 'palette', title: 'Pick your favorite mediums', detail: "We'll suggest sessions you'll enjoy." }
  ];

  if (coursesInProgress > 0) {
    seeds.push({ id: 'courses-in-progress', group: 'suggestions', icon: 'track_changes', title: 'Courses in progress', detail: coursesInProgress === 1 ? 'You have 1 course in progress.' : `You have ${coursesInProgress} courses in progress.` });
  }

  return seeds.map((seed) => ({ ...seed, anchor: { onClick: () => onClick(seed.id) } }));
}
