import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent, DbxButtonComponent, DbxChipDirective, DbxColorDirective, DbxSectionComponent, DbxTextColorDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DocManualActionsItemListComponent } from '../component/manual.actions.item.list.component';
import { makeManualActionItemValues, type ManualActionItemValue } from '../component/manual.actions.item.list';

type SendHistoryTrigger = 'Scheduled' | 'Manual';

interface SendHistoryRow {
  readonly key: string;
  readonly sentAtDate: string;
  readonly sentAtTime: string;
  readonly trigger: SendHistoryTrigger;
  readonly itemsRemaining: number;
  /**
   * Reduction in remaining items since the prior send (green). Mutually exclusive with {@link deltaHint}.
   */
  readonly delta?: Maybe<string>;
  /**
   * Dim placeholder shown when there is no delta (e.g. the baseline send).
   */
  readonly deltaHint?: Maybe<string>;
}

const SEND_HISTORY_ROWS: readonly SendHistoryRow[] = [
  { key: 'may-26', sentAtDate: 'May 26, 2026', sentAtTime: '12:36 AM', trigger: 'Scheduled', itemsRemaining: 3, delta: '↓ 1' },
  { key: 'may-19', sentAtDate: 'May 19, 2026', sentAtTime: '12:36 AM', trigger: 'Scheduled', itemsRemaining: 4, delta: '↓ 2' },
  { key: 'may-14', sentAtDate: 'May 14, 2026', sentAtTime: '3:20 PM', trigger: 'Manual', itemsRemaining: 6, delta: '↓ 1' },
  { key: 'may-12', sentAtDate: 'May 12, 2026', sentAtTime: '12:36 AM', trigger: 'Scheduled', itemsRemaining: 7, deltaHint: 'baseline' }
];

const SEND_HISTORY_COLUMNS = ['sentAt', 'trigger', 'itemsRemaining', 'status'];

/**
 * "Bot status" page mockup (lorem ipsum copy) built entirely from dbx-web
 * utilities (no component styles). It composes a `<dbx-section>` around three
 * cards: a full-width status card, a "Send history" card, and a "Manual
 * actions" card.
 *
 * The top status card is an outlined `<mat-card>` carrying both
 * `.dbx-card-color-accent` and `dbxColor="success"`. The new
 * `.dbx-card-color-accent` utility paints only the card's left edge from the
 * bound color's `--dbx-bg-color-current` token, while the card body keeps its
 * normal unpainted (white / surface) look — the `mat-card.dbx-color` surface
 * paint excludes this class via a zero-specificity `:where(:not(...))` guard,
 * so binding `[dbxColor]` here colors the edge without washing the surface. The
 * green status dot is the `.dbx-dot` utility (a `currentColor` circle) tinted
 * via `[dbxTextColor]="'success'"`, and the right-aligned warn "Pause" button is
 * a raised `<dbx-button color="warn">`.
 *
 * The "Send history" card uses a plain Angular Material `<table mat-table>` (the
 * demo app's first MatTableModule use) styled purely with dbx typography
 * utilities: uppercase, tracked, dim `.dbx-text-label-medium` header cells; a
 * `.dbx-text-title-small` date over a dim `.dbx-text-body-small` time; a tonal
 * `<dbx-chip [small]>` trigger pill (amber `notice` for manual sends, neutral
 * `grey` for scheduled ones); a `[dbxTextColor]="'primary'"` remaining-count
 * with a green `[dbxTextColor]="'success'"` delta (or a dim baseline hint); and
 * a "Sent" status `<dbx-chip color="success">` that projects a leading
 * `.dbx-dot`.
 *
 * The "Manual actions" card reuses the hover-free `.dbx-list-two-line-item`
 * list pattern via {@link DocManualActionsItemListComponent} (rows stay
 * non-clickable; only the trailing button is interactive, raised+primary for
 * the emphasized "Refresh" action and stroked otherwise), followed by a dashed
 * `.dbx-content-border` "Generate lorem content" box laid out as a text +
 * trailing stroked-CTA row. Because content flows below the list, the list
 * wrapper host carries the `dbx-list-auto-height` utility so the `.dbx-list`
 * sizes to its rows instead of filling (and overflowing) the stretched card
 * with its default `height: 100%`.
 *
 * Layout is responsive via Angular Flex Layout's CSS-Grid directives:
 * `gdColumns="5fr 4fr"` with `gdColumns.lt-lg="1fr"` stacks the history and
 * actions cards on smaller viewports, and the status card's header/button row
 * collapses to a column at `lt-sm`. Every button and link carries a
 * `ClickableAnchor` whose `onClick` opens a `MatSnackBar` so each action surface
 * is demonstrably wired.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug layout-bot-status
 * @dbxDocsUiExampleCategory layout
 * @dbxDocsUiExampleSummary Bot status page — success color-accented status card, mat-table send history with tonal dbx-chip pills, and a hover-free manual-actions list card with a dashed generate box.
 * @dbxDocsUiExampleRelated mat-card, dbx-card-color-accent, dbx-color, dbx-chip, dbx-dot, dbx-list-two-line-item, dbx-list-auto-height, dbx-content-border, dbx-text-color, dbx-section, dbx-anchor
 * @dbxDocsUiExampleUses {@link DocManualActionsItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocManualActionsItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocManualActionsItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link ManualActionItemValue} data
 */
@Component({
  selector: 'doc-bot-status-layout-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxSectionComponent, DbxAnchorComponent, DbxButtonComponent, DbxColorDirective, DbxTextColorDirective, DbxChipDirective, DocManualActionsItemListComponent, MatCardModule, MatTableModule, FlexLayoutModule],
  template: `
    <dbx-docs-ui-example header="Bot Status Layout" hint="success color-accented status card, a mat-table send history with tonal dbx-chip pills, and a hover-free manual-actions card with a dashed generate box.">
      <dbx-docs-ui-example-info>
        <p>
          Composes a "bot status" page (lorem ipsum copy) out of a
          <code>&lt;dbx-section&gt;</code>
          wrapping three
          <code>&lt;mat-card&gt;</code>
          s — a full-width status card, a "Send history" card, and a "Manual actions" card — entirely from dbx-web utilities, with no component styles of its own.
        </p>
        <p>
          The top status card carries both
          <code>.dbx-card-color-accent</code>
          and
          <code>dbxColor="success"</code>
          . The new
          <code>.dbx-card-color-accent</code>
          utility paints only the card's left edge from the bound color's
          <code>--dbx-bg-color-current</code>
          token, while the card body keeps its normal unpainted surface — the
          <code>mat-card.dbx-color</code>
          surface paint excludes this class through a zero-specificity
          <code>:where(:not(...))</code>
          guard, so binding
          <code>[dbxColor]</code>
          here colors the edge without washing the whole card. The green status dot is the
          <code>.dbx-dot</code>
          utility (a
          <code>currentColor</code>
          circle) tinted with
          <code>[dbxTextColor]="'success'"</code>
          , and the warn "Pause Lorem Bot" button is a raised
          <code>&lt;dbx-button color="warn"&gt;</code>
          .
        </p>
        <p>
          The "Send history" card uses a plain Angular Material
          <code>&lt;table mat-table&gt;</code>
          (the demo app's first
          <code>MatTableModule</code>
          use) styled purely with dbx typography utilities: uppercase, tracked, dim
          <code>.dbx-text-label-medium</code>
          header cells; a
          <code>.dbx-text-title-small</code>
          date over a dim
          <code>.dbx-text-body-small</code>
          time; a tonal
          <code>&lt;dbx-chip [small]&gt;</code>
          trigger pill (amber
          <code>notice</code>
          for manual sends, neutral
          <code>grey</code>
          for scheduled); a
          <code>[dbxTextColor]="'primary'"</code>
          remaining-count with a green
          <code>[dbxTextColor]="'success'"</code>
          delta (or a dim baseline hint); and a "Sent"
          <code>&lt;dbx-chip color="success"&gt;</code>
          that projects a leading
          <code>.dbx-dot</code>
          .
        </p>
        <p>
          The "Manual actions" card reuses the hover-free
          <code>.dbx-list-two-line-item</code>
          list pattern: rows stay non-clickable and only the trailing button is interactive (raised + primary for the emphasized "Refresh" action, stroked otherwise). Because a dashed
          <code>.dbx-content-border</code>
          "Generate lorem content" box flows below the list, the list wrapper host carries
          <code>dbx-list-auto-height</code>
          so the
          <code>.dbx-list</code>
          sizes to its rows instead of filling the stretched card with its default
          <code>height: 100%</code>
          . Layout is responsive via Angular Flex Layout's CSS-Grid directives —
          <code>gdColumns="5fr 4fr"</code>
          with
          <code>gdColumns.lt-lg="1fr"</code>
          stacks the history and actions cards as the viewport narrows — and every button/link carries a
          <code>ClickableAnchor</code>
          whose
          <code>onClick</code>
          opens a
          <code>MatSnackBar</code>
          .
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <dbx-section header="Lorem Bot" [h]="2" hint="Automated dolor reminders for Ipsum Amet">
          <mat-card appearance="outlined" class="dbx-card-color-accent" dbxColor="success">
            <mat-card-content>
              <div fxLayout="row" fxLayout.lt-sm="column" fxLayoutGap="var(--dbx-padding-3)" fxLayoutAlign="start center">
                <div class="dbx-flex-fill">
                  <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1 dbx-hint">Lorem Bot · Ipsum Amet</div>
                  <div class="dbx-flex-bar">
                    <span class="dbx-dot dbx-icon-spacer" [dbxTextColor]="'success'"></span>
                    <h3 class="dbx-text-title-large">Enabled · Running on schedule</h3>
                  </div>
                  <p class="dbx-hint no-margin dbx-pt1">
                    Next send to Ipsum:
                    <b>Thu, May 28, 2026 · 12:36 AM PT</b>
                    · Last send:
                    <b>2 days ago</b>
                    · Ipsum has
                    <b>3</b>
                    incomplete items
                  </p>
                </div>
                <dbx-anchor [anchor]="pauseAnchor">
                  <dbx-button [raised]="true" color="warn" text="Pause Lorem Bot"></dbx-button>
                </dbx-anchor>
              </div>
            </mat-card-content>
          </mat-card>

          <div class="dbx-pt3" gdColumns="5fr 4fr" gdColumns.lt-lg="1fr" gdGap="var(--dbx-padding-3)">
            <mat-card appearance="outlined">
              <mat-card-content>
                <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1">Send history</div>
                <p class="dbx-hint dbx-mb2">Recent sends and how Ipsum's remaining items changed.</p>
                <table mat-table [dataSource]="sendHistoryRows" class="dbx-w100">
                  <ng-container matColumnDef="sentAt">
                    <th mat-header-cell *matHeaderCellDef class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-hint">Sent at</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="dbx-text-title-small">{{ row.sentAtDate }}</div>
                      <div class="dbx-text-body-small dbx-hint">{{ row.sentAtTime }}</div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="trigger">
                    <th mat-header-cell *matHeaderCellDef class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-hint">Trigger</th>
                    <td mat-cell *matCellDef="let row">
                      <dbx-chip [small]="true" [color]="row.trigger === 'Manual' ? 'notice' : 'grey'">{{ row.trigger }}</dbx-chip>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="itemsRemaining">
                    <th mat-header-cell *matHeaderCellDef class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-hint">Items remaining</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="dbx-text-title-small" [dbxTextColor]="'primary'">{{ row.itemsRemaining }}</span>
                      @if (row.delta) {
                        <span class="dbx-pl1 dbx-text-body-small" [dbxTextColor]="'success'">{{ row.delta }}</span>
                      } @else {
                        <span class="dbx-pl1 dbx-text-body-small dbx-hint">{{ row.deltaHint }}</span>
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-hint">Status</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="dbx-flex-bar">
                        <dbx-chip [small]="true" color="success">
                          <span class="dbx-dot dbx-chip-spacer" [dbxTextColor]="'success'"></span>
                          Sent
                        </dbx-chip>
                      </div>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="sendHistoryColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: sendHistoryColumns"></tr>
                </table>
              </mat-card-content>
            </mat-card>

            <mat-card appearance="outlined">
              <mat-card-content>
                <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1">Manual actions</div>
                <p class="dbx-hint dbx-mb2">Run the bot by hand or change when it next sends.</p>
                <doc-manual-actions-item-list [state]="manualActionsState$"></doc-manual-actions-item-list>
                <div class="dbx-pt3">
                  <div class="dbx-content-border">
                    <div fxLayout="row" fxLayout.lt-sm="column" fxLayoutGap="var(--dbx-padding-3)" fxLayoutAlign="start center">
                      <div class="dbx-flex-fill">
                        <div class="dbx-text-title-medium dbx-pb1">Generate lorem content</div>
                        <p class="dbx-hint no-margin">Draft a personalized lorem for Ipsum's incomplete items.</p>
                      </div>
                      <dbx-anchor [anchor]="generateAnchor">
                        <dbx-button [stroked]="true" icon="auto_awesome" text="Generate"></dbx-button>
                      </dbx-anchor>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </dbx-section>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocBotStatusLayoutExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly sendHistoryRows = SEND_HISTORY_ROWS;
  readonly sendHistoryColumns = SEND_HISTORY_COLUMNS;

  readonly pauseAnchor = this._anchorFor('Pause Lorem Bot');
  readonly generateAnchor = this._anchorFor('Generate lorem content');

  readonly manualActionsState$: Observable<ListLoadingState<ManualActionItemValue>> = of(successResult(makeManualActionItemValues((key) => this._showClicked(key))));

  private _anchorFor(label: string): ClickableAnchor {
    return {
      onClick: () => this._showClicked(label)
    };
  }

  private _showClicked(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'Dismiss', { duration: 3000 });
  }
}
