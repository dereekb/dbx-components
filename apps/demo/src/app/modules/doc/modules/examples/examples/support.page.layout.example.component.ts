import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { DbxAnchorComponent, DbxButtonComponent, DbxIconTileComponent, DbxTextColorDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

interface SupportPageTopicLink {
  readonly label: string;
}

interface SupportPageTopicGroup {
  readonly title: string;
  readonly icon: string;
  readonly links: ReadonlyArray<SupportPageTopicLink>;
}

const SUPPORT_PAGE_TOPICS: ReadonlyArray<SupportPageTopicGroup> = [
  {
    title: 'Lorem Basics',
    icon: 'sentiment_satisfied',
    links: [{ label: 'Quid est lorem ipsum?' }, { label: 'Cur dolor sit amet?' }, { label: 'Consectetur adipiscing elit?' }, { label: 'Sed do eiusmod tempor?' }, { label: 'Incididunt ut labore?' }, { label: 'Et dolore magna aliqua?' }, { label: 'Ut enim ad minim veniam?' }, { label: 'Quis nostrud exercitation?' }, { label: 'Ullamco laboris nisi?' }, { label: 'Aliquip ex ea commodo?' }]
  },
  {
    title: 'Dolor & Pay',
    icon: 'sentiment_satisfied',
    links: [{ label: 'Duis aute irure dolor?' }, { label: 'In reprehenderit in voluptate?' }, { label: 'Velit esse cillum dolore?' }, { label: 'Eu fugiat nulla pariatur?' }]
  },
  {
    title: 'Finding Voluptates',
    icon: 'sentiment_satisfied',
    links: [{ label: 'Excepteur sint occaecat?' }, { label: 'Cupidatat non proident?' }, { label: 'Sunt in culpa qui officia?' }, { label: 'Deserunt mollit anim?' }]
  },
  {
    title: 'Requirements',
    icon: 'sentiment_satisfied',
    links: [{ label: 'Sed ut perspiciatis unde?' }, { label: 'Omnis iste natus error?' }, { label: 'Voluptatem accusantium?' }, { label: 'Doloremque laudantium?' }]
  },
  {
    title: 'Policies & Sapientiae',
    icon: 'sentiment_satisfied',
    links: [{ label: 'Totam rem aperiam codex' }, { label: 'Eaque ipsa quae ab illo?' }, { label: 'Inventore veritatis et quasi?' }, { label: 'Architecto beatae vitae dicta?' }]
  }
];

/**
 * Static "Lorem Support" landing-page mockup composed from Angular
 * Material cards plus dbx-web's `<dbx-button>`, `<dbx-anchor>`, and
 * `<dbx-icon-tile>`: a page header, an outlined hero "Need help?" card
 * with a `<dbx-button>` chat CTA + search input, and a responsive grid
 * of outlined topic cards. Each topic row is a `<dbx-anchor>` whose
 * `ClickableAnchor` carries an `onClick` handler that opens a
 * `MatSnackBar` (a popup with a dismiss button) so the click target is
 * demonstrably wired.
 *
 * Layout uses Angular Flex Layout's CSS-Grid directives —
 * `gdColumns="repeat(auto-fit, minmax(320px, 1fr))"` + `gdGap` — so the
 * topic-card grid auto-collapses from 3 columns to 2 to 1 as the
 * viewport narrows, with no breakpoint media queries or wrapping
 * `<div fxFlex>` elements needed. Inside the hero card the CTA + search
 * row uses `fxLayout="row"` with `fxLayout.lt-md="column"` so the row
 * stacks below tablet width, and each card body renders its link list
 * as a plain `<ul>` / `<li>` so the browser's default disc marker
 * provides the bullet (color-themed via `::marker`).
 *
 * The "Chat with Support" button uses `<dbx-button>` (`flat`,
 * `customButtonColor` / `customTextColor` re-pointing the M3
 * `--mat-sys-inverse-surface` / `--mat-sys-inverse-on-surface` tokens)
 * so it flips correctly between light/dark themes, and composes the
 * `dbx-grow-button` + `dbx-button-big` utilities for full-width / tall
 * presentation. Topic-card avatars are `<dbx-icon-tile [round]>` with
 * `dbxColor="primary"` + `[dbxColorTone]="18"` for the tonal swatch,
 * and topic links use `[dbxTextColor]="'primary'"` for the link color
 * with a `<span class="dbx-link-hover">` wrapper around the projected
 * label for the hover-only-underline link affordance (the `.dbx-link-hover`
 * / `.dbx-link` utilities pair with `.dbx-u` — pointer cursor always,
 * underline on hover for `.dbx-link-hover`, always underlined for `.dbx-link`).
 * The class lives on the projected `<span>` rather than the `<dbx-anchor>`
 * host because `dbx-anchor`'s internal `<a class="dbx-anchor-a">` bakes in
 * `text-decoration: none` and would strip a host-level `.dbx-link`.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug layout-support-page
 * @dbxDocsUiExampleCategory layout
 * @dbxDocsUiExampleSummary Static support landing page — outlined hero card with a dbx-button CTA and search input plus a responsive 3-column grid of topic mat-cards whose rows are dbx-anchor onClick handlers that pop a snackbar.
 * @dbxDocsUiExampleRelated mat-card, dbx-button, dbx-anchor, dbx-icon-tile, mat-form-field, mat-snack-bar, dbx-link, dbx-link-hover
 */
@Component({
  selector: 'doc-support-page-layout-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxAnchorComponent, DbxButtonComponent, DbxIconTileComponent, DbxTextColorDirective, MatCardModule, MatFormFieldModule, MatInputModule, FlexLayoutModule],
  styles: [
    `
      .doc-support-page {
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-large);
      }

      .doc-support-topic-avatar {
        --dbx-icon-tile-width: 28px;
        --dbx-icon-tile-height: 28px;
        --dbx-icon-tile-padding: 0;
        --dbx-icon-tile-icon-size: 18px;
        background: var(--mat-sys-surface-container-high);
      }

      .doc-support-topic-links li::marker {
        color: var(--mat-sys-primary);
      }
    `
  ],
  template: `
    <dbx-docs-ui-example header="Support Landing Page Layout" hint="Page header + hero CTA/search card + responsive 3-column grid of topic cards.">
      <dbx-docs-ui-example-info>
        <p>
          Composes a marketing-style support page out of Angular Material cards plus dbx-web's
          <code>&lt;dbx-button&gt;</code>
          ,
          <code>&lt;dbx-anchor&gt;</code>
          , and
          <code>&lt;dbx-icon-tile&gt;</code>
          : an outlined hero
          <code>&lt;mat-card&gt;</code>
          for the search/CTA row and a responsive grid of outlined topic
          <code>&lt;mat-card&gt;</code>
          boxes whose rows are individual
          <code>&lt;dbx-anchor [anchor]&gt;</code>
          click targets.
        </p>
        <p>
          The topic grid uses Angular Flex Layout's CSS-Grid directives —
          <code>gdColumns="repeat(auto-fit, minmax(320px, 1fr))"</code>
          +
          <code>gdGap</code>
          — so the cards auto-collapse 3 → 2 → 1 columns as the viewport narrows, with no breakpoint media queries or wrapping
          <code>fxFlex</code>
          shells needed. The hero CTA + search row uses
          <code>fxLayout="row"</code>
          with
          <code>fxLayout.lt-md="column"</code>
          so it stacks below the tablet breakpoint. The CTA itself composes the
          <code>.dbx-grow-button</code>
          +
          <code>.dbx-button-big</code>
          utilities (full-width, taller mat-button) instead of hand-rolled
          <code>::ng-deep</code>
          width / height overrides.
        </p>
        <p>
          Topic-card avatars are
          <code>&lt;dbx-icon-tile [round]&gt;</code>
          with
          <code>dbxColor="primary"</code>
          +
          <code>[dbxColorTone]="18"</code>
          for the tonal swatch. Each card body is a plain
          <code>&lt;ul&gt;</code>
          /
          <code>&lt;li&gt;</code>
          so the browser's default disc marker supplies the bullet, and topic links use
          <code>[dbxTextColor]="'primary'"</code>
          for the link color plus a
          <code>&lt;span class="dbx-link-hover"&gt;</code>
          wrapper around the projected label for the hover-only-underline affordance. The
          <code>.dbx-link-hover</code>
          /
          <code>.dbx-link</code>
          utilities pair with
          <code>.dbx-u</code>
          —
          <code>.dbx-link</code>
          is always underlined,
          <code>.dbx-link-hover</code>
          underlines on hover, both keep a pointer cursor. The class lives on the projected
          <code>&lt;span&gt;</code>
          rather than the
          <code>&lt;dbx-anchor&gt;</code>
          host because
          <code>dbx-anchor</code>
          's internal
          <code>&lt;a class="dbx-anchor-a"&gt;</code>
          bakes in
          <code>text-decoration: none</code>
          and would strip a host-level
          <code>.dbx-link</code>
          .
        </p>
        <p>
          Each topic row supplies a
          <code>ClickableAnchor</code>
          with an
          <code>onClick</code>
          callback to
          <code>dbx-anchor</code>
          ; the callback opens a
          <code>MatSnackBar</code>
          with a "Dismiss" action so every link demonstrably triggers a button-bearing popup. Swap the
          <code>onClick</code>
          for a
          <code>ref</code>
          /
          <code>url</code>
          to route or open externally instead.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-p4 doc-support-page">
          <h1 class="dbx-text-headline-large dbx-mb1">Lorem Ipsum Support</h1>
          <p class="dbx-text-body-large dbx-mb4">Dolor sit amet — we're here to help you succeed!</p>

          <mat-card appearance="outlined" class="dbx-mb4">
            <mat-card-content>
              <h3 class="dbx-text-title-medium dbx-mb3">Need help? We're here.</h3>
              <div fxLayout="row" fxLayout.lt-md="column" fxLayoutGap="var(--dbx-padding-3)" fxLayoutAlign="start stretch">
                <dbx-button class="dbx-grow-button dbx-button-form-field-height" fxFlex="1 1 50%" flat icon="help_outline" text="Chat with Support" customButtonColor="var(--mat-sys-inverse-surface)" customTextColor="var(--mat-sys-inverse-on-surface)" (buttonClick)="onChatClick()"></dbx-button>
                <mat-form-field class="dbx-p0" appearance="outline" fxFlex="1 1 50%" subscriptSizing="dynamic">
                  <input matInput placeholder="Search for a topic or question…" />
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          <div gdColumns="repeat(auto-fit, minmax(320px, 1fr))" gdGap="var(--dbx-padding-5)">
            @for (group of topics; track group.title) {
              <mat-card appearance="outlined">
                <mat-card-content>
                  <div fxLayout="row" fxLayoutAlign="start center" fxLayoutGap="var(--dbx-padding-2)" class="dbx-mb3">
                    <dbx-icon-tile class="doc-support-topic-avatar" [icon]="group.icon" [round]="true"></dbx-icon-tile>
                    <span class="dbx-text-title-medium">{{ group.title }}</span>
                  </div>
                  <ul class="doc-support-topic-links">
                    @for (link of group.links; track link.label) {
                      <li class="dbx-pb2">
                        <dbx-anchor [dbxTextColor]="'primary'" [anchor]="anchorFor(link)">
                          <span class="dbx-link-hover">{{ link.label }}</span>
                        </dbx-anchor>
                      </li>
                    }
                  </ul>
                </mat-card-content>
              </mat-card>
            }
          </div>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocSupportPageLayoutExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly topics = SUPPORT_PAGE_TOPICS;

  anchorFor(link: SupportPageTopicLink): ClickableAnchor {
    return {
      onClick: () => this._showClicked(link.label)
    };
  }

  onChatClick(): void {
    this._showClicked('Chat with Support');
  }

  private _showClicked(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'Dismiss', { duration: 3000 });
  }
}
