import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DbxButtonComponent, DbxColorDirective, DbxIconTileComponent, type DbxThemeColor } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

type SupportChatBannerKind = 'activeChat' | 'endedChat';

interface SupportChatBannerView {
  readonly kind: SupportChatBannerKind;
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly color: DbxThemeColor;
}

const BANNER_VIEWS: Record<SupportChatBannerKind, SupportChatBannerView> = {
  activeChat: {
    kind: 'activeChat',
    icon: 'forum',
    title: "You're already in a chat with support",
    text: "To keep your conversation intact, we didn't change it. Open the chat to continue, or end it before asking a new topic.",
    color: 'notice'
  },
  endedChat: {
    kind: 'endedChat',
    icon: 'rate_review',
    title: 'Your previous chat is wrapping up',
    text: "The chat window is on the rating screen, so support can't see new questions yet. Rate or dismiss the rating, then tap a topic again.",
    color: 'warn'
  }
};

/**
 * Status banner card pattern. The surface is a stock Angular Material
 * `<mat-card class="dbx-card-banner" appearance="outlined">` with `[dbxColor]`
 * + `[dbxColorTone]="18"` applied directly to the host. A sibling rule in
 * dbx-web's card stylesheet re-emits the dbx-color background paint at
 * higher specificity than MDC's `.mat-mdc-card` `background-color`, so the
 * tonal `'notice'` / `'warn'` wash shows through every appearance variant
 * — and in tonal mode the text color flips to the vibrant theme color so
 * contrast survives the light wash.
 *
 * `<mat-card-header>` is dropped on purpose — its default padding made the
 * banner feel tall. Instead a `<dbx-icon-tile>` + `<mat-card-title>` row
 * lives inside `<mat-card-content>` via a `.dbx-card-banner-header` child
 * (centered flex row, gap from `--dbx-padding-3`), the body paragraph
 * follows directly underneath, and the action buttons live in
 * `<mat-card-footer>`. The icon tile carries its own `[dbxColor]="view.color"`
 * with `[round]="true"` so it renders as a solid circular avatar in the
 * banner's vibrant color — popping out of the tonal wash without any
 * per-component CSS. "Open chat" passes `[color]="view.color"` so its
 * label tracks the banner's vibrant color; "Dismiss" stays neutral.
 *
 * The `kindSignal` flips between the two presets at the data layer so the
 * template stays one shape — useful when the real banner is driven by a
 * derived store selector. Action clicks pop a `MatSnackBar` to demonstrate
 * the button wiring without depending on routing or chat infrastructure.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug card-support-chat-banner
 * @dbxDocsUiExampleCategory card
 * @dbxDocsUiExampleSummary Outlined mat-card status banner with `[dbxColor]` + `[dbxColorTone]` painting the tonal background. The `.dbx-card-banner` utility lays out a `.dbx-card-banner-header` row inside `<mat-card-content>` (skipping mat-card-header) pairing a vibrant-colored `<dbx-icon-tile [round]>` avatar with a `<mat-card-title>` plus a `<mat-card-footer>` wrap-row of action buttons — toggles between an active-chat (notice) and ending-chat (warn) variant.
 * @dbxDocsUiExampleRelated mat-card, dbx-card-banner, dbx-icon-tile, dbx-color, dbx-button
 */
@Component({
  selector: 'doc-support-banner-card-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatButtonModule, MatCardModule, DbxButtonComponent, DbxColorDirective, DbxIconTileComponent],
  template: `
    <dbx-docs-ui-example header="Support Chat Banner Card" hint="Outlined mat-card with [dbxColor] tonal background, mat-card-header icon + title, content body, and a footer action row.">
      <dbx-docs-ui-example-info>
        <p>
          Reimplements the "you're already in a chat" / "your chat is wrapping up" status banner from a downstream support page using stock Material card slots plus dbx-web color theming. The host is
          <code>&lt;mat-card class="dbx-card-banner" appearance="outlined" [dbxColor]="view.color" [dbxColorTone]="18"&gt;</code>
          . The dbx-web card stylesheet contributes two pieces here: a generic
          <code>mat-card.dbx-color</code>
          rule that re-emits the dbx-color background paint at higher specificity than MDC's
          <code>.mat-mdc-card</code>
          background-color (so the tonal wash actually shows through every appearance variant), and the
          <code>.dbx-card-banner</code>
          utility that centers an
          <code>&lt;mat-icon mat-card-avatar&gt;</code>
          and turns
          <code>&lt;mat-card-footer&gt;</code>
          into a wrapping action row.
        </p>
        <p>
          <code>&lt;mat-card-header&gt;</code>
          is dropped on purpose — its default padding made the banner feel tall. Instead a
          <code>&lt;dbx-icon-tile&gt;</code>
          +
          <code>&lt;mat-card-title&gt;</code>
          row lives inside
          <code>&lt;mat-card-content&gt;</code>
          via a
          <code>.dbx-card-banner-header</code>
          child (centered flex row, gap from
          <code>--dbx-padding-3</code>
          ), the body paragraph follows directly underneath, and the action buttons live in
          <code>&lt;mat-card-footer&gt;</code>
          . The icon tile passes
          <code>[dbxColor]="view.color"</code>
          with
          <code>[round]="true"</code>
          so it renders as a solid circular avatar in the vibrant theme color, popping out of the tonal banner without any per-component CSS. The
          <code>.dbx-card-banner</code>
          utility supplies the header-row flex and the footer wrap-row spacing + padding. The toggle controls at the top reuse the existing
          <code>.dbx-button-wrap-group</code>
          utility.
        </p>
        <p>
          The "Open chat" action passes
          <code>[color]="view.color"</code>
          so its label tracks the banner's vibrant color while keeping a transparent background that lets the tonal wash show through; "Dismiss" stays as a basic
          <code>&lt;dbx-button&gt;</code>
          . Action clicks pop a
          <code>MatSnackBar</code>
          so the demo proves the wiring without depending on routing or chat infrastructure.
        </p>
        <p>
          The
          <code>kindSignal</code>
          swaps the entire view between the two presets without re-templating, modelling the real-world pattern where the banner is driven by a derived store selector.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-button-wrap-group dbx-mb3">
          <button mat-stroked-button (click)="setKind('activeChat')" [disabled]="kindSignal() === 'activeChat'">Show active chat</button>
          <button mat-stroked-button (click)="setKind('endedChat')" [disabled]="kindSignal() === 'endedChat'">Show ending chat</button>
        </div>
        @if (viewSignal(); as view) {
          <mat-card class="dbx-card-banner" appearance="outlined" role="status" [dbxColor]="view.color" [dbxColorTone]="18">
            <mat-card-content>
              <div class="dbx-card-banner-header">
                <dbx-icon-tile [icon]="view.icon" [round]="true" [dbxColor]="view.color"></dbx-icon-tile>
                <mat-card-title>{{ view.title }}</mat-card-title>
              </div>
              <p>{{ view.text }}</p>
            </mat-card-content>
            <mat-card-footer>
              <dbx-button [color]="view.color" text="Open chat" icon="chat_bubble" (buttonClick)="resumeChat()"></dbx-button>
              <dbx-button text="Dismiss" (buttonClick)="dismissBanner()"></dbx-button>
            </mat-card-footer>
          </mat-card>
        }
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocSupportBannerCardExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly kindSignal = signal<SupportChatBannerKind>('activeChat');
  readonly viewSignal = computed<SupportChatBannerView>(() => BANNER_VIEWS[this.kindSignal()]);

  setKind(kind: SupportChatBannerKind): void {
    this.kindSignal.set(kind);
  }

  resumeChat(): void {
    this._notify('Open chat');
  }

  dismissBanner(): void {
    this._notify('Dismiss');
  }

  private _notify(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'OK', { duration: 2000 });
  }
}
