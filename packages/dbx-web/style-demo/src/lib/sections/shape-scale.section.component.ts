import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * A single step of the Material 3 corner-radius scale shown in the {@link DbxStyleDemoShapeScaleSectionComponent}.
 */
interface DbxStyleDemoShapeStep {
  readonly label: string;
  /**
   * The radius applied to the sample tile — a `var(--mat-sys-corner-*)` reference where a web token exists,
   * otherwise the literal px value from the spec.
   */
  readonly radius: string;
  /**
   * The `--mat-sys-corner-*` token backing this step, or `null` when the M3 spec step has no web token.
   */
  readonly webToken?: Maybe<string>;
}

/**
 * Style-demo section showing the full Material 3 corner-radius scale (per
 * https://m3.material.io/styles/shape/corner-radius-scale) as fixed-size tiles, flagging the spec steps that have no
 * web token. A live outlined card + stroked button below follow whichever Shape lever is active, demonstrating that
 * the levers override the component shape tokens (`--mat-card-*` / `--mat-button-*`), not `--mat-sys-corner-*`.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-shape-scale
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary The Material 3 corner-radius scale as fixed tiles, flagging spec steps with no web token.
 * @dbxDocsUiExampleRelated cards, button
 */
@Component({
  selector: 'dbx-style-demo-shape-scale-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatCardModule, DbxButtonComponent],
  template: `
    <dbx-docs-ui-example header="Shape Scale" hint="The Material 3 corner-radius scale.">
      <dbx-docs-ui-example-info>
        <p>
          The
          <a href="https://m3.material.io/styles/shape/corner-radius-scale" target="_blank" rel="noopener">M3 corner-radius scale</a>
          runs from
          <code>none</code>
          to
          <code>full</code>
          . Each tile below is rounded by the matching
          <code>--mat-sys-corner-*</code>
          token; a few spec steps (large-increased, extra-large-increased, extra-extra-large) have no web token and use a literal value. The Shape levers in the controls do not change these
          <code>--mat-sys-corner-*</code>
          values — they re-point the per-component shape tokens (
          <code>--mat-card-*-container-shape</code>
          ,
          <code>--mat-button-*-container-shape</code>
          ), which is why the card and button below re-round while the tiles stay fixed.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-flex" [style.flex-wrap]="'wrap'">
          @for (step of steps; track step.label) {
            <div class="dbx-pr3 dbx-pb3">
              <div [style.border-radius]="step.radius" [style.width.px]="64" [style.height.px]="64" [style.background]="'var(--mat-sys-surface-container-high)'" [style.border]="'1px solid var(--mat-sys-outline-variant)'"></div>
              <div class="dbx-text-label-small dbx-pt1">{{ step.label }}</div>
              @if (step.webToken) {
                <div class="dbx-text-label-small dbx-hint">
                  <code>{{ step.webToken }}</code>
                </div>
              } @else {
                <div class="dbx-text-label-small dbx-hint">no web token</div>
              }
            </div>
          }
        </div>
        <div class="dbx-pt2">
          <p class="dbx-hint">The card and button below follow the active Shape lever:</p>
          <mat-card appearance="outlined">
            <mat-card-content class="dbx-p3">
              <div class="dbx-text-title-medium dbx-mb1">Outlined card</div>
              <dbx-button stroked text="Action"></dbx-button>
            </mat-card-content>
          </mat-card>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoShapeScaleSectionComponent {
  readonly steps: DbxStyleDemoShapeStep[] = [
    { label: 'none', radius: 'var(--mat-sys-corner-none)', webToken: '--mat-sys-corner-none' },
    { label: 'extra-small', radius: 'var(--mat-sys-corner-extra-small)', webToken: '--mat-sys-corner-extra-small' },
    { label: 'small', radius: 'var(--mat-sys-corner-small)', webToken: '--mat-sys-corner-small' },
    { label: 'medium', radius: 'var(--mat-sys-corner-medium)', webToken: '--mat-sys-corner-medium' },
    { label: 'large', radius: 'var(--mat-sys-corner-large)', webToken: '--mat-sys-corner-large' },
    { label: 'large-increased', radius: '20px' },
    { label: 'extra-large', radius: 'var(--mat-sys-corner-extra-large)', webToken: '--mat-sys-corner-extra-large' },
    { label: 'extra-large-increased', radius: '32px' },
    { label: 'extra-extra-large', radius: '48px' },
    { label: 'full', radius: 'var(--mat-sys-corner-full)', webToken: '--mat-sys-corner-full' }
  ];
}
