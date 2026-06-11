import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DbxChipDirective, DbxColorDirective, DbxIconTileComponent, DbxTextColorDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

interface DocHorizontalCardRecommendation {
  readonly name: string;
  readonly detail: string;
  readonly pay: string;
}

interface DocHorizontalCardDayBase {
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly today?: boolean;
}

interface DocHorizontalCardAssignedDay extends DocHorizontalCardDayBase {
  readonly type: 'assigned';
  readonly jobTitle: string;
  readonly locationName: string;
  readonly dateRange: string;
  readonly timeRange: string;
  readonly pay: string;
}

interface DocHorizontalCardOpenDay extends DocHorizontalCardDayBase {
  readonly type: 'open';
  readonly recommendations: readonly DocHorizontalCardRecommendation[];
  readonly moreJobsLabel: string;
}

interface DocHorizontalCardEmptyDay extends DocHorizontalCardDayBase {
  readonly type: 'empty';
  readonly title: string;
  readonly hint: string;
  readonly chipLabel: string;
}

type DocHorizontalCardDay = DocHorizontalCardAssignedDay | DocHorizontalCardOpenDay | DocHorizontalCardEmptyDay;

const DOC_HORIZONTAL_CARD_DAYS: readonly DocHorizontalCardDay[] = [
  {
    type: 'assigned',
    dayLabel: 'Fri',
    dateLabel: 'May 22',
    today: true,
    jobTitle: 'Lorem Ipsum Dolor',
    locationName: 'Sit Amet Consectetur',
    dateRange: '5/4 – 5/22',
    timeRange: '8:15 AM – 4:00 PM MDT',
    pay: '$184'
  },
  {
    type: 'open',
    dayLabel: 'Mon',
    dateLabel: 'May 25',
    recommendations: [
      { name: 'Lorem Ipsum Dolor', detail: 'Sit amet', pay: '$215' },
      { name: 'Consectetur Adipiscing Elit', detail: 'Sed do', pay: '$198' }
    ],
    moreJobsLabel: '+ 4 more lorem ipsum'
  },
  {
    type: 'empty',
    dayLabel: 'Tue',
    dateLabel: 'May 26',
    title: 'Lorem ipsum dolor sit',
    hint: 'Amet consectetur adipiscing elit!',
    chipLabel: '8 lorem ipsum dolor sit'
  },
  {
    type: 'assigned',
    dayLabel: 'Wed',
    dateLabel: 'May 27',
    jobTitle: 'Eiusmod Tempor',
    locationName: 'Sit Amet Consectetur',
    dateRange: '5/27',
    timeRange: '9:00 AM – 5:30 PM MDT',
    pay: '$204'
  }
];

/**
 * Horizontal card row pattern. A `.dbx-card-horizontal` wrapper lays out
 * fixed-width `<mat-card appearance="outlined" class="dbx-card-horizontal-item">`
 * cards as an equal-height (`align-items: stretch`) row that scrolls on the
 * x-axis for responsiveness. Each card's CTA lives in `<mat-card-footer>`,
 * which the item utility pushes to the card bottom via `margin-top: auto`
 * so the buttons stay aligned across cards of varying content.
 *
 * The full-bleed status bar is a plain `<div class="dbx-card-horizontal-header">`
 * placed before `<mat-card-content>` — mat-card children stack in a
 * padding-less flex column, so the bar spans edge to edge for free, and its
 * top corners inherit the card radius. The bar is painted entirely by
 * `[dbxColor]`: solid `'primary'` for the ASSIGNED variant (the leading
 * `<mat-icon>` follows `currentColor`), tonal `'notice'` + `[dbxColorTone]`
 * for the OPEN variant whose `.dbx-card-horizontal-header-dot` also rides
 * `currentColor`.
 *
 * The "TODAY" tab is a `<dbx-chip [tone]="100" [small]="true">` with the
 * `.dbx-card-horizontal-tab` utility — absolutely positioned to poke above
 * the card's top edge by `--dbx-card-horizontal-tab-overlap`. The row
 * reserves that same overlap as `padding-top` because `overflow-x: auto`
 * scroll-clips anything outside the padding box; one token drives both so
 * they cannot drift apart. The today card also toggles
 * `.dbx-card-horizontal-item-highlight` to repaint the outlined-card border
 * in the primary color (the `.dbx-card-select.dbx-card-selected` pattern).
 *
 * Body content is composed from existing utilities only: eyebrow labels via
 * `.dbx-text-label-small .dbx-uppercase .dbx-tracked-wide .dbx-hint`, the
 * date heading via `.dbx-text-headline-small` + `[dbxTextColor]`,
 * `.dbx-card-horizontal-detail` icon rows, `.dbx-card-horizontal-divider`
 * hairlines, `.dbx-card-horizontal-mini` recommendation rows, and a
 * `<dbx-icon-tile [round]>` + `<dbx-chip>` empty state.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug card-horizontal-week
 * @dbxDocsUiExampleCategory card
 * @dbxDocsUiExampleSummary Horizontally scrolling `.dbx-card-horizontal` row of fixed-width, equal-height outlined mat-cards — full-bleed `[dbxColor]` status header bars, an absolutely positioned `.dbx-card-horizontal-tab` "TODAY" chip (with scroll-clip-safe headroom), `.dbx-card-horizontal-detail` icon rows, `.dbx-card-horizontal-mini` recommendation rows, and bottom-anchored full-width footer CTAs — demonstrated as a week view of job day cards.
 * @dbxDocsUiExampleRelated mat-card, dbx-card-select, dbx-chip, dbx-icon-tile, dbx-color, dbx-text-color
 */
@Component({
  selector: 'doc-horizontal-card-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatButtonModule, MatCardModule, MatIconModule, DbxChipDirective, DbxColorDirective, DbxIconTileComponent, DbxTextColorDirective],
  template: `
    <dbx-docs-ui-example header="Horizontal Card Row" hint="Fixed-width, equal-height outlined mat-cards in a .dbx-card-horizontal row that scrolls on the x-axis, with full-bleed [dbxColor] status headers and bottom-anchored footer CTAs.">
      <dbx-docs-ui-example-info>
        <p>
          A
          <code>.dbx-card-horizontal</code>
          wrapper lays out
          <code>&lt;mat-card appearance="outlined" class="dbx-card-horizontal-item"&gt;</code>
          cards as a fixed-width (
          <code>--dbx-card-horizontal-item-width</code>
          , 300px default), equal-height row that scrolls horizontally instead of wrapping. Each card's CTA lives in
          <code>&lt;mat-card-footer&gt;</code>
          , which the item utility anchors to the card bottom with
          <code>margin-top: auto</code>
          — so the buttons stay on one line even though the cards carry different amounts of content.
        </p>
        <p>
          The status bar is a plain
          <code>&lt;div class="dbx-card-horizontal-header"&gt;</code>
          placed before
          <code>&lt;mat-card-content&gt;</code>
          : mat-card children stack in a padding-less flex column, so the bar spans the card edge-to-edge with no negative margins, and its top corners inherit the card radius. It is painted entirely by
          <code>[dbxColor]</code>
          — solid
          <code>'primary'</code>
          for ASSIGNED (the check icon follows
          <code>currentColor</code>
          ), tonal
          <code>'notice'</code>
          +
          <code>[dbxColorTone]</code>
          for OPEN, whose
          <code>.dbx-card-horizontal-header-dot</code>
          also rides
          <code>currentColor</code>
          .
        </p>
        <p>
          The "TODAY" tab is a
          <code>&lt;dbx-chip [tone]="100" [small]="true"&gt;</code>
          with the
          <code>.dbx-card-horizontal-tab</code>
          utility, absolutely positioned to poke above the card by
          <code>--dbx-card-horizontal-tab-overlap</code>
          . Because the row's
          <code>overflow-x: auto</code>
          scroll-clips anything outside its padding box, the row reserves that same overlap as top padding — one token drives both, so the tab can never be clipped. The today card also toggles
          <code>.dbx-card-horizontal-item-highlight</code>
          , repainting the outlined-card border via
          <code>--mat-outlined-card-outline-color</code>
          (the same pattern as
          <code>.dbx-card-select</code>
          ).
        </p>
        <p>
          Body content is composed from existing utilities:
          <code>.dbx-card-horizontal-detail</code>
          icon rows,
          <code>.dbx-card-horizontal-divider</code>
          hairlines,
          <code>.dbx-card-horizontal-mini</code>
          recommendation rows, eyebrow labels from
          <code>.dbx-text-label-small .dbx-uppercase .dbx-tracked-wide</code>
          , themed text from
          <code>[dbxTextColor]</code>
          , and a
          <code>&lt;dbx-icon-tile [round]&gt;</code>
          +
          <code>&lt;dbx-chip&gt;</code>
          empty state.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-card-horizontal">
          @for (day of days; track day.dateLabel) {
            <mat-card appearance="outlined" class="dbx-card-horizontal-item" [class.dbx-card-horizontal-item-highlight]="day.today">
              @if (day.today) {
                <dbx-chip class="dbx-card-horizontal-tab" color="primary" [tone]="100" [small]="true">TODAY</dbx-chip>
              }
              @if (day.type === 'assigned') {
                <div class="dbx-card-horizontal-header" dbxColor="primary">
                  <mat-icon inline>check_circle</mat-icon>
                  <span class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide">Assigned</span>
                </div>
              } @else {
                <div class="dbx-card-horizontal-header" dbxColor="notice" [dbxColorTone]="18">
                  <span class="dbx-card-horizontal-header-dot"></span>
                  <span class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide">Open</span>
                </div>
              }
              <mat-card-content>
                <div class="dbx-text-label-small dbx-uppercase dbx-tracked-wide dbx-hint">{{ day.dayLabel }}</div>
                <h3 class="dbx-text-headline-small dbx-m0" [dbxTextColor]="day.type === 'assigned' ? 'primary' : undefined">{{ day.dateLabel }}</h3>
                <div class="dbx-card-horizontal-divider"></div>
                @switch (day.type) {
                  @case ('assigned') {
                    <div class="dbx-text-title-medium dbx-mb1">{{ day.jobTitle }}</div>
                    <div class="dbx-card-horizontal-detail">
                      <mat-icon>home</mat-icon>
                      <span>{{ day.locationName }}</span>
                    </div>
                    <div class="dbx-card-horizontal-detail">
                      <mat-icon>calendar_today</mat-icon>
                      <span>{{ day.dateRange }}</span>
                    </div>
                    <div class="dbx-card-horizontal-detail">
                      <mat-icon>schedule</mat-icon>
                      <span>{{ day.timeRange }}</span>
                    </div>
                    <div class="dbx-card-horizontal-divider"></div>
                    <div class="dbx-card-horizontal-detail">
                      <span class="dbx-text-label-small dbx-uppercase dbx-tracked-wide">Pay</span>
                      <span class="dbx-spacer"></span>
                      <span class="dbx-text-title-medium" dbxTextColor="primary">{{ day.pay }}</span>
                    </div>
                  }
                  @case ('open') {
                    <div class="dbx-text-title-small dbx-text-center dbx-mb2">Lorem ipsum dolor</div>
                    @for (job of day.recommendations; track job.name) {
                      <div class="dbx-card-horizontal-mini">
                        <div>
                          <div class="dbx-text-label-large">{{ job.name }}</div>
                          <div class="dbx-text-label-small dbx-hint">{{ job.detail }}</div>
                        </div>
                        <div class="dbx-text-title-medium" dbxTextColor="primary">{{ job.pay }}</div>
                      </div>
                    }
                    <div class="dbx-text-center dbx-mt2">
                      <button mat-button (click)="notify(day.moreJobsLabel)">
                        {{ day.moreJobsLabel }}
                        <mat-icon iconPositionEnd>arrow_forward</mat-icon>
                      </button>
                    </div>
                  }
                  @case ('empty') {
                    <div class="dbx-flex-column dbx-flex-center dbx-text-center">
                      <dbx-icon-tile class="dbx-mb2" icon="search" [round]="true" dbxColor="notice" [dbxColorTone]="18"></dbx-icon-tile>
                      <div class="dbx-text-title-medium">{{ day.title }}</div>
                      <div class="dbx-hint dbx-mb2">{{ day.hint }}</div>
                      <dbx-chip color="primary" [small]="true">{{ day.chipLabel }}</dbx-chip>
                    </div>
                  }
                }
              </mat-card-content>
              <mat-card-footer>
                @switch (day.type) {
                  @case ('assigned') {
                    <button mat-stroked-button (click)="notify('Lorem ipsum')">
                      Lorem ipsum
                      <mat-icon iconPositionEnd>arrow_forward</mat-icon>
                    </button>
                  }
                  @case ('open') {
                    <button mat-flat-button (click)="notify('Dolor sit amet')">
                      Dolor sit amet
                      <mat-icon iconPositionEnd>arrow_forward</mat-icon>
                    </button>
                  }
                  @case ('empty') {
                    <button mat-flat-button (click)="notify('Consectetur elit')">
                      Consectetur elit
                      <mat-icon iconPositionEnd>arrow_forward</mat-icon>
                    </button>
                  }
                }
              </mat-card-footer>
            </mat-card>
          }
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocHorizontalCardExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly days = DOC_HORIZONTAL_CARD_DAYS;

  notify(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'OK', { duration: 2000 });
  }
}
