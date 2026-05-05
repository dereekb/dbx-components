import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBar } from '@angular/material/progress-bar';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

/**
 * Page-top "hero" card pattern that surfaces a single primary call-to-action
 * (e.g. an onboarding-progress summary) above the rest of the page content.
 *
 * Built on Material 3's `<mat-card appearance="filled">`. The component class
 * `.doc-hero-card` only re-points existing M3 system tokens — it does not
 * paint hard-coded colours or sizes — so the card flips correctly between
 * light and dark themes:
 *
 * - `--mat-card-filled-container-color` → `--mat-sys-inverse-surface`
 * - card text                          → `--mat-sys-inverse-on-surface`
 *
 * Layout uses dbx spacing utilities (`.dbx-p4`, `.dbx-mb3`, `.dbx-pb1`,
 * `.dbx-spacer`, `.dbx-bold`) instead of bespoke margin / padding values.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug card-hero-onboarding-progress
 * @dbxDocsUiExampleCategory card
 * @dbxDocsUiExampleSummary Top-of-page hero card on an inverse surface — eyebrow, headline, progress bar, secondary CTA, and trailing percent.
 * @dbxDocsUiExampleRelated mat-card, dbx-card-box, dbx-content-pit
 * @dbxDocsUiExampleUses {@link DocHeroCardExampleComponent} example
 */
@Component({
  selector: 'doc-hero-card-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatCardModule, MatButtonModule, MatIconModule, MatProgressBar],
  template: `
    <dbx-docs-ui-example header="Hero Card (Onboarding Progress)" hint="Top-of-page hero on an inverse surface with eyebrow, headline, progress, action, and trailing percent.">
      <dbx-docs-ui-example-info>
        <p>
          A "hero" card is a high-emphasis module placed at the top of a page that summarises the user's most important task. This example uses Angular Material's
          <code>&lt;mat-card appearance="filled"&gt;</code>
          and only re-points the M3
          <code>--mat-card-filled-container-color</code>
          token to
          <code>--mat-sys-inverse-surface</code>
          (with text painted from
          <code>--mat-sys-inverse-on-surface</code>
          ) so the card flips correctly between light/dark themes without any hard-coded colours.
        </p>
        <p>
          Layout uses standard dbx utility classes —
          <code>.dbx-p4</code>
          for the card body inset,
          <code>.dbx-mb3</code>
          /
          <code>.dbx-pb1</code>
          /
          <code>.dbx-mb1</code>
          for vertical rhythm, and
          <code>.dbx-bold</code>
          for emphasised labels — instead of bespoke
          <code>margin</code>
          /
          <code>padding</code>
          values.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <mat-card appearance="filled" class="doc-hero-card">
          <mat-card-content class="dbx-p4 doc-hero-card-content">
            <div class="doc-hero-card-main">
              <div class="doc-hero-eyebrow dbx-bold dbx-pb1">YOUR ONBOARDING PROGRESS</div>
              <h3 class="dbx-bold dbx-mb1">{{ remaining }} requirements to go</h3>
              <p class="dbx-mb3">
                <span class="dbx-bold">{{ completed }} of {{ total }}</span>
                requirements completed
              </p>
              <mat-progress-bar mode="determinate" [value]="progressPercent" class="doc-hero-progress dbx-mb3"></mat-progress-bar>
              <button mat-stroked-button class="doc-hero-action">
                View all requirements
                <mat-icon iconPositionEnd>arrow_forward</mat-icon>
              </button>
            </div>
            <div class="doc-hero-percent dbx-bold" aria-hidden="true">{{ progressPercent }}%</div>
          </mat-card-content>
        </mat-card>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `,
  styles: [
    `
      .doc-hero-card {
        --mat-card-filled-container-color: var(--mat-sys-inverse-surface);
        color: var(--mat-sys-inverse-on-surface);
      }

      .doc-hero-card-content {
        display: flex;
        align-items: flex-start;
        gap: var(--dbx-padding-3);
      }

      .doc-hero-card-main {
        flex: 1;
        min-width: 0;
      }

      .doc-hero-eyebrow {
        font: var(--mat-sys-label-medium);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .doc-hero-progress {
        --mdc-linear-progress-track-color: color-mix(in srgb, var(--mat-sys-inverse-on-surface) 25%, transparent);
      }

      .doc-hero-action {
        --mdc-outlined-button-label-text-color: var(--mat-sys-inverse-on-surface);
        --mdc-outlined-button-outline-color: color-mix(in srgb, var(--mat-sys-inverse-on-surface) 40%, transparent);
      }

      .doc-hero-percent {
        font: var(--mat-sys-headline-large);
      }
    `
  ]
})
export class DocHeroCardExampleComponent {
  readonly completed = 3;
  readonly total = 7;

  get remaining(): number {
    return Math.max(0, this.total - this.completed);
  }

  get progressPercent(): number {
    return this.total > 0 ? Math.round((this.completed / this.total) * 100) : 0;
  }
}
