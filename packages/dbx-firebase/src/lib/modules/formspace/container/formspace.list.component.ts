import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TimeDistancePipe } from '@dereekb/dbx-core';
import { AbstractDbxSelectionListViewDirective, AbstractDbxSelectionListWrapperDirective, AbstractDbxValueListViewItemComponent, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, provideDbxListView, provideDbxListViewWrapper, type DbxSelectionValueListViewConfig, type DbxValueAsListItem } from '@dereekb/dbx-web';
import { AppFormSpaceTypeConfigService, type DocumentDataWithIdAndKey, type FormSpace, FormSpaceProcessingState, FormSpaceState } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { of } from 'rxjs';

/**
 * One value of a {@link DbxFirebaseFormSpaceListComponent}.
 *
 * The document rather than the model, because a listing of spaces exists to be selected from and the key is
 * what a selection is worth anything as — which is also what a {@link FormSpaceCollectionStore} emits.
 */
export type DbxFirebaseFormSpaceListValue = DocumentDataWithIdAndKey<FormSpace>;

/**
 * A FormSpace wrapped as a list item.
 */
export type DbxFirebaseFormSpaceListItem = DbxValueAsListItem<DbxFirebaseFormSpaceListValue>;

/**
 * How one FormSpace's lifecycle reads on its row.
 */
export interface DbxFirebaseFormSpaceListItemStatus {
  /**
   * The sentence the row's second line opens with, ending in whatever connects it to {@link date}.
   */
  readonly label: string;
  /**
   * The date the sentence ends on, rendered as a distance. Omitted when the state has no date to name.
   */
  readonly date?: Maybe<Date>;
  /**
   * The row's leading icon.
   */
  readonly icon: string;
  /**
   * Css class applied to the second line.
   */
  readonly cssClass: string;
}

/**
 * Describes where a FormSpace has got to, for a listing to render.
 *
 * A space is read by its STATE first and its processing outcome second, because those are two different
 * questions and only one of them is ever live: a draft has no processing to report, and a submitted space
 * has no editing left to report. Exported as a pure function so an app that wants its own wording has the
 * verdict without the row.
 *
 * @param formSpace - The space to describe.
 * @returns How the space reads.
 *
 * @example
 * ```ts
 * const status = dbxFirebaseFormSpaceListItemStatus(formSpace); // { label: 'Processed', ... }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseFormSpaceListItemStatus(formSpace: FormSpace): DbxFirebaseFormSpaceListItemStatus {
  let result: DbxFirebaseFormSpaceListItemStatus;

  switch (formSpace.s) {
    case FormSpaceState.DRAFT:
      result = { label: 'Draft, last edited', date: formSpace.uat, icon: 'edit_note', cssClass: 'dbx-hint' };
      break;
    case FormSpaceState.EXPIRED:
      result = { label: 'Expired', date: formSpace.uat, icon: 'schedule', cssClass: 'dbx-warn' };
      break;
    default:
      // SUBMITTED and ARCHIVED are both past the one-way door, so what is worth saying about them is how
      // their PROCESSING went rather than that they are no longer editable
      switch (formSpace.ps) {
        case FormSpaceProcessingState.SUCCESS:
          result = { label: formSpace.s === FormSpaceState.ARCHIVED ? 'Archived' : 'Processed', date: formSpace.cpat ?? formSpace.sat, icon: 'check_circle', cssClass: 'dbx-hint' };
          break;
        case FormSpaceProcessingState.FAILED:
          result = { label: 'Processing failed', date: formSpace.cpat ?? formSpace.sat, icon: 'error', cssClass: 'dbx-warn' };
          break;
        case FormSpaceProcessingState.PROCESSING:
          result = { label: 'Processing, submitted', date: formSpace.sat, icon: 'hourglass_top', cssClass: 'dbx-hint' };
          break;
        case FormSpaceProcessingState.DO_NOT_PROCESS:
          result = { label: 'Submitted', date: formSpace.sat, icon: 'inventory_2', cssClass: 'dbx-hint' };
          break;
        default:
          result = { label: 'Queued for processing, submitted', date: formSpace.sat, icon: 'hourglass_empty', cssClass: 'dbx-hint' };
          break;
      }
      break;
  }

  return result;
}

/**
 * Builds the tracking key for a row.
 *
 * Carries the row's RENDERED state rather than only the space's key, for the same reason
 * {@link keyForDbxFirebaseStorageFileListEntry} does: an item value reaches its component through the
 * injected list-item provider and the injection comparison ignores it, so a row keyed by identity alone is
 * never rebuilt — leaving a draft that has since been submitted still reading "Draft".
 *
 * @param formSpace - The space to key.
 * @returns The tracking key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function keyForDbxFirebaseFormSpaceListValue(formSpace: DbxFirebaseFormSpaceListValue): string {
  return [formSpace.key, formSpace.s, formSpace.ps, formSpace.n, formSpace.uat.getTime()].join('_');
}

/**
 * Lists FormSpaces, each row naming the space and where it has got to.
 *
 * The screen the {@link FormSpaceCollectionStore} exists for — "my forms" — and the reason `firestore.rules`
 * grants `list` on `/fsp` at all. Pair it with `dbxFirebaseCollectionList` on a store constrained by
 * `formSpacesForOwnerQuery(ownerKey)`, or hand it a `[state]` of its own when the page has already narrowed
 * the owner's spaces to the ones it is about.
 *
 * Selection is 'view', so a listing decides what selecting a row means — usually an anchor modifier, either
 * routing to the space or opening it in place.
 *
 * The list FILLS its container and scrolls, which is what the two-column left panel it usually sits in wants.
 * A page rendering it inline below other content — inside a `dbx-section`, say — should add the
 * `.dbx-list-auto-height` utility so it sizes to its rows instead.
 *
 * @example
 * ```html
 * <dbx-firebase-formspace-list [state]="formSpaceListStateSignal()" dbxListItemModifier [dbxListItemAnchorModifier]="makeFormSpaceAnchor"></dbx-firebase-formspace-list>
 * ```
 */
@Component({
  selector: 'dbx-firebase-formspace-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListViewWrapper(DbxFirebaseFormSpaceListComponent),
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-firebase-formspace-list'
  }
})
export class DbxFirebaseFormSpaceListComponent extends AbstractDbxSelectionListWrapperDirective<DbxFirebaseFormSpaceListValue> {
  constructor() {
    super({
      componentClass: DbxFirebaseFormSpaceListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

/**
 * Internal list view for {@link DbxFirebaseFormSpaceListComponent}.
 */
@Component({
  selector: 'dbx-firebase-formspace-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListView(DbxFirebaseFormSpaceListViewComponent),
  imports: [DbxSelectionValueListViewComponentImportsModule]
})
export class DbxFirebaseFormSpaceListViewComponent extends AbstractDbxSelectionListViewDirective<DbxFirebaseFormSpaceListValue> {
  readonly config: DbxSelectionValueListViewConfig<DbxFirebaseFormSpaceListItem> = {
    componentClass: DbxFirebaseFormSpaceListViewItemComponent,
    mapValuesToItemValues: (values) =>
      of(
        values.map((value) => ({
          ...value,
          itemValue: value,
          // the state's icon, which the list paints itself
          icon: dbxFirebaseFormSpaceListItemStatus(value).icon,
          key: keyForDbxFirebaseFormSpaceListValue(value)
        }))
      )
  };
}

/**
 * One FormSpace: its name, and where it has got to.
 *
 * The name comes from the space's own `n` first and the type's registered name second, so a space created
 * without a display name still reads as the kind of form it is rather than as its type id.
 */
@Component({
  selector: 'dbx-firebase-formspace-list-view-item',
  template: `
    <div class="dbx-list-two-line-item">
      <div class="item-left">
        <div class="item-title dbx-text-truncate" [title]="name">{{ name }}</div>
        <div class="item-details" [ngClass]="status.cssClass">
          <!-- The trailing &ngsp; separates the label from the date, and belongs to the label rather than
               sitting between the spans: the two read as one sentence ("Processed 4 hours ago"), and Angular
               drops a whitespace-only text node between two elements, running the words together. -->
          <span>{{ status.label }}&ngsp;</span>
          @if (status.date; as date) {
            <span>{{ date | timeDistance }}</span>
          }
        </div>
      </div>
    </div>
  `,
  imports: [NgClass, TimeDistancePipe]
})
export class DbxFirebaseFormSpaceListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseFormSpaceListValue> {
  /**
   * The app's FormSpace type registry, when it registered one.
   *
   * OPTIONAL, as everywhere else the registry is read on the client: without it a row falls back to the
   * space's own name and then its type, rather than refusing to render.
   */
  readonly appFormSpaceTypeConfigService = inject(AppFormSpaceTypeConfigService, { optional: true });

  readonly status = dbxFirebaseFormSpaceListItemStatus(this.itemValue);

  get name(): string {
    const formSpace = this.itemValue;
    return formSpace.n || this.appFormSpaceTypeConfigService?.registeredConfigForFormSpaceType(formSpace.t)?.name || formSpace.t;
  }
}
