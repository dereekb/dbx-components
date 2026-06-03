import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DbxChipDirective, DbxColorDirective, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxIconTileComponent, type DbxThemeColor } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

interface FeedbackChoice {
  readonly key: string;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
  readonly color: DbxThemeColor;
}

const FEEDBACK_CHOICES: readonly FeedbackChoice[] = [
  { key: 'allow', icon: 'thumb_up', title: 'Allow', subtitle: 'Welcome them back anytime', color: 'primary' },
  { key: 'block', icon: 'block', title: 'Block', subtitle: "They won't return here", color: 'warn' },
  { key: 'review', icon: 'flag', title: 'Review', subtitle: 'Flag for a closer look', color: 'notice' }
];

/**
 * Selectable "choice" card pattern. Each option is a stock
 * `<mat-card appearance="outlined">` carrying the new `.dbx-card-select`
 * utility — which centers the card body in a column (large `<mat-icon>`,
 * title, subtitle) and exposes a top-right slot for a checkmark badge.
 *
 * Selection is a single-select `signal`. The selected card receives
 * `[dbxColor]` + `[dbxColorTone]="16"`, so the existing `mat-card.dbx-color`
 * / `.dbx-color-tonal` rules paint the tonal background wash and flip the
 * card text to the vibrant theme color — which the centered `<mat-icon>`
 * (rendered in `currentColor`) and the title inherit for free. The
 * `.dbx-card-selected` modifier repaints the outlined-card border to that
 * same `--dbx-bg-color-current` value, so the border matches the wash.
 *
 * The round checkmark in the corner is a `<dbx-icon-tile [round]>` carrying
 * its own `[dbxColor]` (no tone), so it renders as a solid vibrant circle
 * with a contrast-color check — popping out of the tonal wash without any
 * per-component CSS. The unselected card omits `[dbxColor]` entirely, so it
 * keeps the neutral outline + on-surface text.
 *
 * The "FEEDBACK" / "REQUIRED" header reuses the M3 overline utilities
 * (`.dbx-text-label-medium` + `.dbx-uppercase` + `.dbx-tracked-wide`) and a
 * tonal `<dbx-chip color="notice">` pill. The choices sit in a `dbxFlexGroup`
 * row with each option an equal-width `[dbxFlexSize]="2"` column, so the cards
 * shrink in unison and stay the same size; `.dbx-card-select` fills its column
 * height (`height: 100%`) to keep them equal-height even when a subtitle wraps.
 * `[breakToColumn]` stacks them into a single column below the `small`
 * breakpoint.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug card-feedback-selection
 * @dbxDocsUiExampleCategory card
 * @dbxDocsUiExampleSummary Single-select row of centered `.dbx-card-select` choice cards laid out with `dbxFlexGroup` + equal-width `[dbxFlexSize]` columns (equal-size as the screen shrinks, stacking below the `small` breakpoint). The selected `<mat-card appearance="outlined">` gets a tonal `[dbxColor]` wash, a matching themed border, and a round `<dbx-icon-tile [round]>` checkmark badge in the top-right; unselected cards stay neutral. Large glyphs are plain `<mat-icon>` that inherit the card's flipped text color.
 * @dbxDocsUiExampleRelated mat-card, dbx-card-select, dbx-icon-tile, dbx-color, dbx-chip, dbx-flex-group, dbx-flex-size
 */
@Component({
  selector: 'doc-feedback-selection-card-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatCardModule, MatIconModule, DbxChipDirective, DbxColorDirective, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxIconTileComponent],
  template: `
    <dbx-docs-ui-example header="Feedback Selection Cards" hint="Single-select row of equal-size centered choice cards (dbxFlexGroup) — the selected card gets a tonal [dbxColor] wash, a matching themed border, and a round checkmark badge.">
      <dbx-docs-ui-example-info>
        <p>
          A "selection" / "choice" card lets the user pick exactly one option from a small set, with the chosen card emphasised. Each option is a stock
          <code>&lt;mat-card appearance="outlined"&gt;</code>
          carrying the
          <code>.dbx-card-select</code>
          utility, which centers the card body in a column (a large
          <code>&lt;mat-icon&gt;</code>
          , a title, and a subtitle) and exposes a top-right slot for a checkmark badge via a
          <code>.dbx-card-select-check</code>
          child.
        </p>
        <p>
          Selection is a single-select
          <code>signal</code>
          . The selected card receives
          <code>[dbxColor]</code>
          +
          <code>[dbxColorTone]="16"</code>
          , so the existing
          <code>mat-card.dbx-color</code>
          /
          <code>.dbx-color-tonal</code>
          rules paint the tonal background wash and flip the card text to the vibrant theme color — which the centered
          <code>&lt;mat-icon&gt;</code>
          (rendered in
          <code>currentColor</code>
          ) and the title inherit for free. The
          <code>.dbx-card-selected</code>
          modifier repaints the outlined-card border to that same
          <code>--dbx-bg-color-current</code>
          value, so the border matches the wash without any hard-coded colour.
        </p>
        <p>
          The round checkmark is a
          <code>&lt;dbx-icon-tile [round]&gt;</code>
          carrying its own
          <code>[dbxColor]</code>
          (no tone), so it renders as a solid vibrant circle with a contrast-colour check. The unselected card omits
          <code>[dbxColor]</code>
          entirely, so it keeps the neutral outline + on-surface text. Each choice carries its own semantic
          <code>color</code>
          (a positive
          <code>'primary'</code>
          , a destructive
          <code>'warn'</code>
          , and a
          <code>'notice'</code>
          review), so the emphasis colour follows the meaning of the option.
        </p>
        <p>
          The options sit in a
          <code>dbxFlexGroup</code>
          row, each an equal-width
          <code>[dbxFlexSize]="2"</code>
          column, so the cards stay the same size and shrink in unison as the viewport narrows — and
          <code>.dbx-card-select</code>
          fills its column height (
          <code>height: 100%</code>
          ) so they stay equal-height even if one subtitle wraps. Below the
          <code>small</code>
          breakpoint,
          <code>[breakToColumn]</code>
          stacks them into a single column.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-flex-bar dbx-mb3">
          <span class="dbx-text-label-medium dbx-uppercase dbx-tracked-wide dbx-icon-spacer">Feedback</span>
          <dbx-chip [small]="true" color="notice">Required</dbx-chip>
        </div>
        <div dbxFlexGroup breakpoint="small" [breakToColumn]="true">
          @for (choice of choices; track choice.key) {
            <div [dbxFlexSize]="2">
              <mat-card appearance="outlined" class="dbx-card-select" role="button" [class.dbx-card-selected]="isSelected(choice.key)" [attr.aria-pressed]="isSelected(choice.key)" [dbxColor]="isSelected(choice.key) ? choice.color : null" [dbxColorTone]="isSelected(choice.key) ? 16 : null" (click)="select(choice.key)">
                <mat-card-content>
                  @if (isSelected(choice.key)) {
                    <dbx-icon-tile class="dbx-card-select-check" icon="check" [round]="true" [dbxColor]="choice.color"></dbx-icon-tile>
                  }
                  <mat-icon class="dbx-card-select-icon">{{ choice.icon }}</mat-icon>
                  <div class="dbx-text-title-medium">{{ choice.title }}</div>
                  <div class="dbx-note">{{ choice.subtitle }}</div>
                </mat-card-content>
              </mat-card>
            </div>
          }
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocFeedbackSelectionCardExampleComponent {
  readonly choices = FEEDBACK_CHOICES;
  readonly selectedKeySignal = signal<string>('allow');

  isSelected(key: string): boolean {
    return this.selectedKeySignal() === key;
  }

  select(key: string): void {
    this.selectedKeySignal.set(key);
  }
}
