import { Component, inject } from '@angular/core';
import { of } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import {
  AbstractDbxSelectionListWrapperDirective,
  AbstractDbxSelectionListViewDirective,
  AbstractDbxValueListViewItemComponent,
  type DbxSelectionValueListViewConfig,
  type DbxThemeColor,
  type DbxValueListItemSeparatorContext,
  DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR,
  dbxValueListItemSeparatorDecisionFunction,
  provideDbxListView,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  DbxListWrapperComponentImportsModule,
  DbxSelectionValueListViewComponentImportsModule,
  DbxAnchorComponent,
  DbxButtonComponent,
  DbxChipDirective,
  DbxColorDirective
} from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type ScheduleDayItemValue, type ScheduleDayItemValueWithSelection, type ScheduleDaySession, skippedDaysBetweenScheduleDays } from './schedule.day.item.list';

/**
 * Demo wrapper that renders {@link ScheduleDayItemValue} days as
 * `.dbx-list-detail-item` rows: a full-height `.item-leading-block` date
 * column, the booked session's title + icon lines, and a divided trailing button.
 *
 * The list is hover-free and only the trailing button is interactive: the
 * host applies `dbx-list-no-hover-effects` (no state layer, default cursor)
 * and `mapValuesToItemValues` leaves `item.anchor` undefined, so the row is
 * never a click target and the list turns its ripple off.
 *
 * Non-consecutive days are separated by a "…" gap marker: the view's
 * `separatorConfig` injects a {@link DocScheduleDayGapComponent} between two
 * days whenever the next day isn't the following calendar day.
 */
@Component({
  selector: 'doc-schedule-day-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-list-no-hover-effects dbx-list-card-items-list'
  }
})
export class DocScheduleDayItemListComponent extends AbstractDbxSelectionListWrapperDirective<ScheduleDayItemValue> {
  constructor() {
    super({
      componentClass: DocScheduleDayItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-schedule-day-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocScheduleDayItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  }
})
export class DocScheduleDayItemListViewComponent extends AbstractDbxSelectionListViewDirective<ScheduleDayItemValue> {
  // Drop `anchor` (the trailing button owns it; the row stays non-clickable and ripple-free).
  // Separate two days with a "…" gap whenever the next day isn't the following calendar day.
  readonly config: DbxSelectionValueListViewConfig<ScheduleDayItemValueWithSelection> = {
    componentClass: DocScheduleDayItemListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, anchor: undefined }))),
    separatorConfig: {
      componentClass: DocScheduleDayGapComponent,
      showSeparator: dbxValueListItemSeparatorDecisionFunction<ScheduleDayItemValue>((previous, next) => previous != null && next != null && skippedDaysBetweenScheduleDays(previous.day, next.day) > 0)
    }
  };
}

/**
 * "…" separator rendered between two non-consecutive schedule days, using the `.dbx-list-detail-item-gap`
 * utility so the ellipsis lines up under the rows' date column. Reads the two days it sits between from
 * {@link DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR}.
 */
@Component({
  selector: 'doc-schedule-day-gap',
  template: `
    <div class="dbx-list-detail-item-gap">
      <span class="item-leading"><mat-icon>more_vert</mat-icon></span>
      <span>{{ label }}</span>
    </div>
  `,
  imports: [MatIconModule]
})
export class DocScheduleDayGapComponent {
  readonly separator = inject<DbxValueListItemSeparatorContext<ScheduleDayItemValue>>(DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR);

  get label(): string {
    const { previous, next } = this.separator;
    const skippedDays = previous && next ? skippedDaysBetweenScheduleDays(previous.itemValue.day, next.itemValue.day) : 0;
    return `${skippedDays} ${skippedDays === 1 ? 'day' : 'days'} skipped`;
  }
}

@Component({
  selector: 'doc-schedule-day-item-list-view-item',
  template: `
    <div class="dbx-list-detail-item">
      <div class="item-leading-block dbx-color-bg" [dbxColor]="stateColor" [dbxColorTone]="14">
        <span class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide">{{ dayLabel }}</span>
        <span class="dbx-text-title-large">{{ dateLabel }}</span>
        @if (session) {
          <dbx-chip [color]="stateColor" [tone]="100" [small]="true">BOOKED</dbx-chip>
        } @else {
          <dbx-chip [color]="stateColor" [small]="true">
            <span class="dbx-dot"></span>
            <span class="dbx-pl1">OPEN</span>
          </dbx-chip>
        }
      </div>
      <div class="item-content">
        @if (session; as session) {
          <span class="item-title">{{ session.title }}</span>
          <span class="item-line">
            <mat-icon>location_on</mat-icon>
            {{ session.locationName }}
          </span>
          <span class="item-line">
            <mat-icon>calendar_today</mat-icon>
            {{ session.dateRange }}
          </span>
          <span class="item-line">
            <mat-icon>schedule</mat-icon>
            {{ session.timeRange }}
          </span>
        } @else {
          <span class="item-title">Nothing booked</span>
          <span class="item-line">This day is still free.</span>
        }
      </div>
      <div class="item-trailing item-trailing-divided">
        <dbx-anchor [anchor]="anchor">
          @if (session) {
            <dbx-button class="dbx-nowrap" [stroked]="true" text="View Details"></dbx-button>
          } @else {
            <dbx-button class="dbx-nowrap" [tonal]="true" color="primary" text="Browse sessions"></dbx-button>
          }
        </dbx-anchor>
      </div>
    </div>
  `,
  imports: [MatIconModule, DbxAnchorComponent, DbxButtonComponent, DbxChipDirective, DbxColorDirective]
})
export class DocScheduleDayItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<ScheduleDayItemValue> {
  get dayLabel(): string {
    return this.itemValue.dayLabel;
  }

  get dateLabel(): string {
    return this.itemValue.dateLabel;
  }

  get session(): Maybe<ScheduleDaySession> {
    return this.itemValue.session;
  }

  get stateColor(): DbxThemeColor {
    return this.itemValue.state === 'booked' ? 'success' : 'notice';
  }

  get anchor(): ClickableAnchor {
    return this.itemValue.anchor;
  }
}
