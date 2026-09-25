import { type DbxThemeColor, type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

/**
 * Small status chip rendered under a to do's detail line, e.g. `Expires Oct 12`.
 */
export interface TodoItemChip {
  readonly text: string;
  readonly color: DbxThemeColor;
}

export interface TodoItemValue {
  readonly key: string;
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
  readonly chip?: Maybe<TodoItemChip>;
  /**
   * Whether to paint the row with the urgent `.dbx-list-detail-item-highlight` wash.
   */
  readonly highlight?: Maybe<boolean>;
  /**
   * Whole-row click target.
   */
  readonly anchor: ClickableAnchor;
}

export type TodoItemValueWithSelection = DbxValueAsListItem<TodoItemValue>;

export type TodoItemSeed = Omit<TodoItemValue, 'anchor'>;

/**
 * Presentation variants of the To Do panel:
 *
 * - `urgent` — a highlighted urgent row (with an expiry chip) floated to the top.
 * - `standard` — plain rows only.
 * - `empty` — no to dos; the list renders its "all caught up" empty state.
 */
export type TodoItemPresentation = 'urgent' | 'standard' | 'empty';

export const TODO_ITEM_URGENT_SEEDS: readonly TodoItemSeed[] = [
  {
    key: 'membership-expiring',
    icon: 'card_membership',
    title: 'Membership Expiring',
    detail: 'Your studio membership expires soon. Renew to keep your booked sessions.',
    chip: { text: 'Expires Oct 12', color: 'notice' },
    highlight: true
  },
  { key: 'studio-waiver', icon: 'draw', title: 'Sign the studio waiver', detail: 'Required before your first hands-on session.' },
  { key: 'profile-picture', icon: 'photo_camera', title: 'Add a profile picture', detail: 'Instructors will see your photo when you join a session.' },
  { key: 'emergency-contact', icon: 'contact_phone', title: 'Add an emergency contact', detail: 'Required for kiln and wheel workshops.' },
  { key: 'class-preferences', icon: 'palette', title: 'Pick your favorite mediums', detail: "We'll suggest sessions you'll enjoy." },
  { key: 'courses-in-progress', icon: 'track_changes', title: 'Courses In Progress', detail: 'You have 2 course(s) in progress.' }
];

export const TODO_ITEM_STANDARD_SEEDS: readonly TodoItemSeed[] = [
  { key: 'profile-picture', icon: 'photo_camera', title: 'Add a profile picture', detail: 'Instructors will see your photo when you join a session.' },
  { key: 'studio-waiver', icon: 'draw', title: 'Sign the studio waiver', detail: 'Sign the studio waiver before your first hands-on session.' },
  { key: 'emergency-contact', icon: 'contact_phone', title: 'Add an emergency contact', detail: 'Required for kiln and wheel workshops.' },
  { key: 'courses-in-progress', icon: 'track_changes', title: 'Courses In Progress', detail: 'You have 2 course(s) in progress.' },
  { key: 'membership-expiring', icon: 'schedule', title: 'Membership Expiring', detail: 'Your studio membership expires in the next 30 days.' }
];

/**
 * Builds the {@link TodoItemValue}s for a {@link TodoItemPresentation},
 * giving each item an `anchor.onClick` that fires `onClick(key)`.
 *
 * Each item's key is prefixed with the presentation. The list reuses an item
 * component whenever the key stays the same (and the component keeps the item
 * it was created with), so switching presentations must change the keys for
 * the rows to pick up the new presentation's data, e.g. the urgent highlight.
 *
 * @param presentation - Which seed set to build; `empty` returns no items.
 * @param onClick - Invoked with the seed `key` when a row is clicked.
 * @returns Anchored values ready for the list state.
 */
export function makeTodoItemValues(presentation: TodoItemPresentation, onClick: (key: string) => void): TodoItemValue[] {
  let seeds: readonly TodoItemSeed[];

  switch (presentation) {
    case 'urgent':
      seeds = TODO_ITEM_URGENT_SEEDS;
      break;
    case 'standard':
      seeds = TODO_ITEM_STANDARD_SEEDS;
      break;
    default:
      seeds = [];
      break;
  }

  return seeds.map((seed) => ({
    ...seed,
    key: `${presentation}:${seed.key}`,
    anchor: { onClick: () => onClick(seed.key) }
  }));
}
