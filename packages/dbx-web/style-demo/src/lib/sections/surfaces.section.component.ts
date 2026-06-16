import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * A single labeled swatch in the {@link DbxStyleDemoSurfacesSectionComponent} ramp.
 */
interface DbxStyleDemoSurface {
  readonly label: string;
  readonly background: string;
  readonly color: string;
}

/**
 * A single bordered outline sample in the {@link DbxStyleDemoSurfacesSectionComponent}.
 */
interface DbxStyleDemoOutline {
  readonly label: string;
  readonly border: string;
}

/**
 * Style-demo section showing the full Material 3 surface ramp (`surface-dim` → `surface-container-highest`, plus
 * `inverse-surface`) painted straight from the `--mat-sys-*` tokens, so the host theme's neutral palette and the
 * playground's surface-tint lever are easy to read under light and dark.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-surfaces
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary The Material 3 surface ramp painted from --mat-sys-surface* tokens, plus outline samples.
 * @dbxDocsUiExampleRelated cards, color
 */
@Component({
  selector: 'dbx-style-demo-surfaces-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent],
  template: `
    <dbx-docs-ui-example header="Surfaces" hint="The Material 3 surface ramp from system tokens.">
      <dbx-docs-ui-example-info>
        <p>
          The M3 neutral ramp —
          <code>--mat-sys-surface-dim</code>
          through
          <code>--mat-sys-surface-container-highest</code>
          , plus the
          <code>inverse-surface</code>
          pair — is what every dbx surface (cards, menus, sheets) is layered from. Each swatch reads its colour straight from the token, so the surface-tint lever shifts the
          <code>surface</code>
          /
          <code>-container</code>
          /
          <code>-container-high</code>
          rows live, and all of them flip with light/dark.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-flex-column">
          @for (surface of surfaces; track surface.label) {
            <div class="dbx-p2" [style.background]="surface.background" [style.color]="surface.color">
              <span class="dbx-text-label-medium">{{ surface.label }}</span>
            </div>
          }
          <p class="dbx-pt2" [style.color]="'var(--mat-sys-on-surface-variant)'">
            Secondary text uses
            <code>--mat-sys-on-surface-variant</code>
            against these surfaces.
          </p>
          <div class="dbx-flex">
            @for (outline of outlines; track outline.label) {
              <div class="dbx-p2 dbx-pr3" [style.border]="outline.border">
                <span class="dbx-text-label-small">{{ outline.label }}</span>
              </div>
            }
          </div>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoSurfacesSectionComponent {
  readonly surfaces: DbxStyleDemoSurface[] = [
    { label: 'surface-dim', background: 'var(--mat-sys-surface-dim)', color: 'var(--mat-sys-on-surface)' },
    { label: 'surface', background: 'var(--mat-sys-surface)', color: 'var(--mat-sys-on-surface)' },
    { label: 'surface-bright', background: 'var(--mat-sys-surface-bright)', color: 'var(--mat-sys-on-surface)' },
    { label: 'surface-container-lowest', background: 'var(--mat-sys-surface-container-lowest)', color: 'var(--mat-sys-on-surface)' },
    { label: 'surface-container-low', background: 'var(--mat-sys-surface-container-low)', color: 'var(--mat-sys-on-surface)' },
    { label: 'surface-container', background: 'var(--mat-sys-surface-container)', color: 'var(--mat-sys-on-surface)' },
    { label: 'surface-container-high', background: 'var(--mat-sys-surface-container-high)', color: 'var(--mat-sys-on-surface)' },
    { label: 'surface-container-highest', background: 'var(--mat-sys-surface-container-highest)', color: 'var(--mat-sys-on-surface)' },
    { label: 'inverse-surface', background: 'var(--mat-sys-inverse-surface)', color: 'var(--mat-sys-inverse-on-surface)' }
  ];

  readonly outlines: DbxStyleDemoOutline[] = [
    { label: 'outline', border: '1px solid var(--mat-sys-outline)' },
    { label: 'outline-variant', border: '1px solid var(--mat-sys-outline-variant)' }
  ];
}
