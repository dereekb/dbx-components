import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TimeDistancePipe } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxSpacerDirective } from '../../../layout';
import { DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_CLASS, DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_DATE_STYLE, type DbxFileListItemComponentConfig, type DbxFileListItemDetailsDateStyle } from './download.file.list';

/**
 * One row of a file listing: an optional leading icon, the file's name, an optional details line, and
 * whatever controls the caller projects into the row's trailing slot.
 *
 * Renders the `dbx-list-two-line-item` layout, which is a flat utility rather than something scoped to a
 * dbx-list, so the same row works both as the item component of a dbx-list and inside a plain list of its
 * own. That is the point of the component: the two file listings that exist differ in their list machinery
 * and in their controls, and share only this row.
 *
 * @example
 * ```html
 * <dbx-file-list-item name="report.pdf" details="Uploaded" [detailsDate]="uploadedAt" detailsDateStyle="distance">
 *   <dbx-download-blob-button [config]="downloadConfig"></dbx-download-blob-button>
 * </dbx-file-list-item>
 * ```
 */
@Component({
  selector: 'dbx-file-list-item',
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item">
      @if (iconSignal(); as icon) {
        <mat-icon class="item-icon">{{ icon }}</mat-icon>
      }
      <div class="item-left">
        <div class="mat-subtitle-2 dbx-text-truncate" [title]="nameSignal()">{{ nameSignal() }}</div>
        @if (hasDetailsSignal()) {
          <div class="item-details" [ngClass]="detailsClassSignal()">
            @if (detailsSignal(); as details) {
              <!-- The trailing &ngsp; is the separator from the date that follows, and belongs to the text
                   rather than sitting between the spans: the details read as one sentence with the date
                   ("Uploaded 3 hours ago"), and Angular drops a whitespace-only text node between two
                   elements, running the words together. Carried here rather than led on the date so a row
                   with only a date does not open on a space. -->
              <span>{{ details }}&ngsp;</span>
            }
            @if (renderedDetailsDateSignal(); as detailsDate) {
              @if (isDetailsDateDistanceSignal()) {
                <span>{{ detailsDate | timeDistance }}</span>
              } @else {
                <span>{{ detailsDate | date: detailsDateStyleSignal() }}</span>
              }
            }
          </div>
        }
      </div>
      <dbx-spacer></dbx-spacer>
      <div class="item-right"><ng-content></ng-content></div>
    </div>
  `,
  host: {
    class: 'dbx-file-list-item d-block'
  },
  imports: [DatePipe, NgClass, MatIconModule, TimeDistancePipe, DbxSpacerDirective]
})
export class DbxFileListItemComponent {
  readonly config = input<Maybe<DbxFileListItemComponentConfig>>();

  readonly name = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();
  readonly details = input<Maybe<string>>();
  readonly detailsDate = input<Maybe<Date>>();
  readonly detailsDateStyle = input<Maybe<DbxFileListItemDetailsDateStyle>>();
  readonly detailsClass = input<Maybe<string>>();

  readonly nameSignal = computed(() => {
    const config = this.config();
    return this.name() ?? config?.name;
  });

  readonly iconSignal = computed(() => {
    const config = this.config();
    return this.icon() ?? config?.icon;
  });

  readonly detailsSignal = computed(() => {
    const config = this.config();
    return this.details() ?? config?.details;
  });

  readonly detailsDateSignal = computed(() => {
    const config = this.config();
    return this.detailsDate() ?? config?.detailsDate;
  });

  readonly detailsDateStyleSignal = computed<DbxFileListItemDetailsDateStyle>(() => {
    const config = this.config();
    return this.detailsDateStyle() ?? config?.detailsDateStyle ?? DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_DATE_STYLE;
  });

  readonly detailsClassSignal = computed(() => {
    const config = this.config();
    return this.detailsClass() ?? config?.detailsClass ?? DEFAULT_DBX_FILE_LIST_ITEM_DETAILS_CLASS;
  });

  readonly isDetailsDateDistanceSignal = computed(() => {
    const detailsDateStyle = this.detailsDateStyleSignal();
    return detailsDateStyle === 'distance' || detailsDateStyle === 'distance-past';
  });

  /**
   * The date the row actually renders.
   *
   * A `'distance-past'` date is pinned to now once it runs ahead of the clock, so a timestamp that landed
   * marginally in the future reads as "less than a minute ago" rather than as something yet to happen.
   */
  readonly renderedDetailsDateSignal = computed(() => {
    const detailsDateStyle = this.detailsDateStyleSignal();
    const detailsDate = this.detailsDateSignal();
    const now = new Date();
    let result = detailsDate;

    if (detailsDate != null && detailsDateStyle === 'distance-past' && detailsDate > now) {
      result = now;
    }

    return result;
  });

  readonly hasDetailsSignal = computed(() => {
    const detailsDate = this.detailsDateSignal();
    return Boolean(this.detailsSignal() || detailsDate);
  });
}
