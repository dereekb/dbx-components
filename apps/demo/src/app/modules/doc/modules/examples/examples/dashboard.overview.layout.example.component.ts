import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent, DbxButtonSpacerDirective, DbxColorDirective, DbxContentPitDirective, DbxSectionComponent, DbxTextColorDirective, type DbxColorInput } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DocWorthKnowingItemListComponent } from '../component/worth.knowing.item.list.component';
import { makeWorthKnowingItemValues, type WorthKnowingItemValue } from '../component/worth.knowing.item.list';

interface DashboardHeroStat {
  readonly label: string;
  readonly value: string;
  /**
   * Optional stat-number color. Omitted stats inherit the hero card's contrast color.
   */
  readonly textColor?: Maybe<DbxColorInput>;
}

interface DashboardStatCard {
  readonly label: string;
  readonly value?: Maybe<string>;
  readonly valueColor?: Maybe<DbxColorInput>;
  readonly delta?: Maybe<string>;
  readonly hint?: Maybe<string>;
  /**
   * When set the card renders a primary link instead of a stat value.
   */
  readonly linkText?: Maybe<string>;
}

const DASHBOARD_HERO_STATS: readonly DashboardHeroStat[] = [
  { label: 'Total', value: '2' },
  // --mat-sys-primary would go dark-on-dark in light theme; inverse-primary is the M3 token designed for text on inverse surfaces.
  { label: 'Filled', value: '2', textColor: { color: 'var(--mat-sys-inverse-primary)' } },
  // No inverse-error token exists — mixing toward the inverse contrast color keeps the warn tint legible on the dark card in both themes.
  { label: 'Unfilled', value: '0', textColor: { color: 'color-mix(in srgb, var(--mat-sys-error) 60%, var(--mat-sys-inverse-on-surface))' } }
];

const DASHBOARD_STAT_CARDS: readonly DashboardStatCard[] = [
  { label: 'Fill rate · 30d', value: '94.2%', valueColor: 'primary', delta: '2.4 pts', hint: 'vs. prior 30d' },
  { label: 'Lorems filled · 30d', value: '147', delta: '12', hint: 'vs. prior 30d' },
  { label: 'Upcoming lorems', linkText: 'Post a lorem', hint: 'None scheduled in the next 7 days' },
  { label: 'Active long-term ipsums', value: '6' }
];

/**
 * "Overview" dashboard page mockup composed from a `<dbx-section>` whose
 * `[sectionHeader]` slot carries the page-level action buttons, a dark hero
 * `<mat-card>` painted by the app-registered `demo-inverse`
 * `DbxColorConfigTemplate` (`[dbxColor]="{ template: 'demo-inverse' }"` →
 * `--mat-sys-inverse-surface` / `--mat-sys-inverse-on-surface`, so it flips
 * correctly between light and dark themes), an accent-edged "Worth knowing"
 * card hosting a hover-free dbx-list, and a responsive auto-fit row of
 * outlined stat cards.
 *
 * The hero's three stat boxes are `<dbx-content-pit>` blocks composed with the
 * `.dbx-color-border` utility — a subtle 1px border mixed from the inherited
 * `--dbx-color-current` contrast color, so the border reads as "light" on the
 * dark card without any hard-coded color. Pits inside a `[dbxColor]`-painted
 * surface automatically swap their `--mat-sys-surface-container` background
 * for a low wash of the same contrast variable (tunable via
 * `--dbx-content-pit-color-tone`), secondary hero text uses the
 * `.dbx-color-text-dim` utility, and the card content composes
 * `mat-card-content.dbx-flex-column` + `.dbx-flex-fill` so the stat row fills
 * the card's grid-stretched height. The component declares no styles of its
 * own — everything is dbx-web utilities.
 *
 * The "Worth knowing" card is a `.dbx-card-accent` `<mat-card>` (left accent
 * edge, override `--dbx-card-accent-color`) whose list reuses the
 * `.dbx-list-two-line-item` anchor-button list pattern: the wrapper host
 * applies `dbx-list-no-hover-effects` so rows render without hover
 * cursor/state layer, rows stay non-clickable (`mapValuesToItemValues` strips
 * the anchor), and only the optional trailing `<dbx-anchor>`-wrapped stroked
 * button is interactive.
 *
 * Layout uses Angular Flex Layout's CSS-Grid directives — `gdColumns="2fr 1fr"`
 * with a `gdColumns.lt-md="1fr"` override for the main row (hero + list stack
 * on tablets and below) and `gdColumns="repeat(auto-fit, minmax(220px, 1fr))"`
 * for the bottom stat-card row, which reflows 4 → 2 → 1 as the viewport
 * narrows. Every button/link carries a `ClickableAnchor` whose `onClick`
 * opens a `MatSnackBar` so each action surface is demonstrably wired.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug layout-dashboard-overview
 * @dbxDocsUiExampleCategory layout
 * @dbxDocsUiExampleSummary Dashboard overview page — dbx-section header with action buttons, dark inverse hero card with dbx-color-border stat pits, an accent-edged hover-free list card, and a responsive auto-fit row of stat cards.
 * @dbxDocsUiExampleRelated dbx-section, dbx-color, dbx-color-border, dbx-color-text-dim, dbx-content-pit, mat-card, dbx-card-accent, dbx-list-two-line-item, dbx-icon-tile, dbx-anchor, dbx-text-color, button-spacer
 * @dbxDocsUiExampleUses {@link DocWorthKnowingItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocWorthKnowingItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocWorthKnowingItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link WorthKnowingItemValue} data
 */
@Component({
  selector: 'doc-dashboard-overview-layout-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxSectionComponent, DbxAnchorComponent, DbxButtonSpacerDirective, DbxColorDirective, DbxTextColorDirective, DbxContentPitDirective, DocWorthKnowingItemListComponent, MatCardModule, MatButtonModule, MatIconModule, FlexLayoutModule],
  template: `
    <dbx-docs-ui-example header="Dashboard Overview Layout" hint="dbx-section header with actions, dark inverse hero card with dbx-color-border stat pits, accent list card, and a responsive stat-card row.">
      <dbx-docs-ui-example-info>
        <p>
          Composes a dashboard "Overview" page out of a
          <code>&lt;dbx-section&gt;</code>
          whose
          <code>[sectionHeader]</code>
          slot projects the page-level action buttons to the right of the title, a dark hero
          <code>&lt;mat-card&gt;</code>
          , a "Worth knowing"
          <code>&lt;mat-card&gt;</code>
          with a hover-free list, and a responsive row of outlined stat cards.
        </p>
        <p>
          The hero card is painted by the app-registered
          <code>demo-inverse</code>
          color template —
          <code>[dbxColor]="&#123; template: 'demo-inverse' &#125;"</code>
          resolves to
          <code>--mat-sys-inverse-surface</code>
          /
          <code>--mat-sys-inverse-on-surface</code>
          via the
          <code>DbxColorService</code>
          , so the card flips correctly between light and dark themes without hard-coded colors. Its three stat boxes are
          <code>&lt;dbx-content-pit&gt;</code>
          blocks composed with the
          <code>.dbx-color-border</code>
          utility, which mixes a subtle 1px border from the inherited
          <code>--dbx-color-current</code>
          contrast color (override
          <code>--dbx-color-border-tone</code>
          /
          <code>--dbx-color-border-width</code>
          to tune it). Pits inside a
          <code>[dbxColor]</code>
          -painted surface automatically swap their default
          <code>--mat-sys-surface-container</code>
          background for a low wash of the same contrast variable (tune with
          <code>--dbx-content-pit-color-tone</code>
          ), secondary text uses the
          <code>.dbx-color-text-dim</code>
          utility, and the stat numbers use
          <code>[dbxTextColor]</code>
          configs (
          <code>--mat-sys-inverse-primary</code>
          for the filled count) that stay legible on the inverse surface. The component declares no styles of its own — the card content fills the stretched card height via
          <code>mat-card-content.dbx-flex-column</code>
          +
          <code>.dbx-flex-fill</code>
          .
        </p>
        <p>
          The "Worth knowing" card reuses the
          <code>.dbx-list-two-line-item</code>
          anchor-button list pattern: the list wrapper host applies
          <code>dbx-list-no-hover-effects</code>
          so rows render with no background or hover state,
          <code>mapValuesToItemValues</code>
          strips each row's anchor so the row itself stays non-clickable, and only the optional trailing
          <code>&lt;dbx-anchor&gt;</code>
          -wrapped stroked button is interactive. The card's blue left edge is the
          <code>.dbx-card-accent</code>
          utility (override
          <code>--dbx-card-accent-color</code>
          /
          <code>--dbx-card-accent-border-width</code>
          ).
        </p>
        <p>
          Layout is responsive via Angular Flex Layout's CSS-Grid directives:
          <code>gdColumns="2fr 1fr"</code>
          with
          <code>gdColumns.lt-md="1fr"</code>
          stacks the hero and list cards below tablet width, and the bottom row's
          <code>gdColumns="repeat(auto-fit, minmax(220px, 1fr))"</code>
          reflows the four stat cards 4 → 2 → 1 as the viewport narrows. Every button and link carries a
          <code>ClickableAnchor</code>
          whose
          <code>onClick</code>
          opens a
          <code>MatSnackBar</code>
          so each action surface is demonstrably wired.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <dbx-section header="Overview" hint="Lorem Ipsum Consectetur · Wed, Apr 22, 2026">
          <div sectionHeader class="dbx-flex-bar">
            <dbx-anchor [anchor]="last30DaysAnchor">
              <button mat-stroked-button>
                <mat-icon>calendar_today</mat-icon>
                Last 30 days
                <mat-icon iconPositionEnd>arrow_drop_down</mat-icon>
              </button>
            </dbx-anchor>
            <dbx-button-spacer></dbx-button-spacer>
            <dbx-anchor [anchor]="viewLoremsAnchor">
              <button mat-stroked-button>
                View Lorems
                <mat-icon iconPositionEnd>arrow_forward</mat-icon>
              </button>
            </dbx-anchor>
            <dbx-button-spacer></dbx-button-spacer>
            <dbx-anchor [anchor]="createLoremAnchor">
              <button mat-flat-button>
                <mat-icon>add</mat-icon>
                Create Lorem
              </button>
            </dbx-anchor>
          </div>

          <div class="dbx-pt3" gdColumns="2fr 1fr" gdColumns.lt-lg="1fr" gdGap="var(--dbx-padding-3)">
            <mat-card appearance="filled" [dbxColor]="{ template: 'demo-inverse' }">
              <mat-card-content class="dbx-p4 dbx-flex-column dbx-flex-fill">
                <div fxLayout="row" fxLayout.lt-sm="column" fxLayoutGap="var(--dbx-padding-3)" fxLayoutAlign="start start">
                  <div class="dbx-flex-fill">
                    <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1 dbx-color-text-dim">Today · Lorem days</div>
                    <h3 class="dbx-text-title-large dbx-mb1">2 lorems on the schedule</h3>
                    <p class="dbx-color-text-dim">Summary for Apr 22, 2026 · all filled</p>
                  </div>
                  <dbx-anchor [anchor]="todaysLoremsAnchor">
                    <button mat-stroked-button>
                      View today's lorems
                      <mat-icon iconPositionEnd>arrow_forward</mat-icon>
                    </button>
                  </dbx-anchor>
                </div>
                <div class="dbx-pt3 dbx-flex-fill" gdColumns="repeat(3, 1fr)" gdColumns.lt-sm="1fr" gdGap="var(--dbx-padding-2)">
                  @for (stat of heroStats; track stat.label) {
                    <dbx-content-pit class="dbx-color-border">
                      <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1 dbx-color-text-dim">{{ stat.label }}</div>
                      <div class="dbx-text-display-small" [dbxTextColor]="stat.textColor">{{ stat.value }}</div>
                    </dbx-content-pit>
                  }
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card appearance="outlined" class="dbx-card-accent">
              <mat-card-content>
                <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1">Worth knowing</div>
                <p class="dbx-hint dbx-mb2">Milestones, streaks, and things that need your attention.</p>
                <doc-worth-knowing-item-list [state]="worthKnowingState$"></doc-worth-knowing-item-list>
              </mat-card-content>
            </mat-card>
          </div>

          <div class="dbx-pt3" gdColumns="repeat(auto-fit, minmax(220px, 1fr))" gdGap="var(--dbx-padding-3)">
            @for (card of statCards; track card.label) {
              <mat-card appearance="outlined">
                <mat-card-content>
                  <div class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-pb1">{{ card.label }}</div>
                  @if (card.linkText) {
                    <div class="dbx-text-headline-medium">
                      <dbx-anchor [dbxTextColor]="'primary'" [anchor]="postLoremAnchor">
                        <span class="dbx-link-hover">{{ card.linkText }} →</span>
                      </dbx-anchor>
                    </div>
                  } @else {
                    <div class="dbx-text-headline-large" [dbxTextColor]="card.valueColor">{{ card.value }}</div>
                  }
                  @if (card.delta || card.hint) {
                    <div class="dbx-text-body-small dbx-pt1">
                      @if (card.delta) {
                        <span class="dbx-pr1" [dbxTextColor]="'success'">
                          <strong>▲ {{ card.delta }}</strong>
                        </span>
                      }
                      @if (card.hint) {
                        <span class="dbx-hint">{{ card.hint }}</span>
                      }
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            }
          </div>
        </dbx-section>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocDashboardOverviewLayoutExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly heroStats = DASHBOARD_HERO_STATS;
  readonly statCards = DASHBOARD_STAT_CARDS;

  readonly last30DaysAnchor = this._anchorFor('Last 30 days');
  readonly viewLoremsAnchor = this._anchorFor('View Lorems');
  readonly createLoremAnchor = this._anchorFor('Create Lorem');
  readonly todaysLoremsAnchor = this._anchorFor(`View today's lorems`);
  readonly postLoremAnchor = this._anchorFor('Post a lorem');

  readonly worthKnowingState$: Observable<ListLoadingState<WorthKnowingItemValue>> = of(successResult(makeWorthKnowingItemValues((key) => this._showClicked(key))));

  private _anchorFor(label: string): ClickableAnchor {
    return {
      onClick: () => this._showClicked(label)
    };
  }

  private _showClicked(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'Dismiss', { duration: 3000 });
  }
}
