import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';
import { DbxButtonComponent, DbxFlexGroupDirective, DbxFlexSizeDirective } from '@dereekb/dbx-web';

/**
 * Style-demo section showing the three Material 3 card appearances (outlined, raised, filled) painted purely
 * from `--mat-sys-*` surface tokens, so they respond live to the playground's surface-tint and corner-shape levers.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-cards
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary Material 3 card appearances (outlined, elevated, filled) painted from system surface tokens.
 * @dbxDocsUiExampleRelated mat-card, dbx-card-box
 */
@Component({
  selector: 'dbx-style-demo-cards-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatCardModule, DbxButtonComponent, DbxFlexGroupDirective, DbxFlexSizeDirective],
  template: `
    <dbx-docs-ui-example header="Cards" hint="Material 3 card appearances painted from system surface tokens.">
      <dbx-docs-ui-example-info>
        <p>
          The three M3 card appearances —
          <code>outlined</code>
          ,
          <code>raised</code>
          , and
          <code>filled</code>
          — draw their container colour and shape from
          <code>--mat-sys-surface*</code>
          and the
          <code>--mat-card-*-container-shape</code>
          tokens. No hard-coded colours or radii, so they flip with light/dark and respond live to the surface-tint and corner-shape levers.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div dbxFlexGroup>
          <div [dbxFlexSize]="2">
            <mat-card appearance="outlined">
              <mat-card-content class="dbx-p3">
                <div class="dbx-text-title-medium dbx-mb1">Outlined</div>
                <p class="dbx-text-body-medium">Surface with a hairline outline.</p>
                <dbx-button stroked text="Action"></dbx-button>
              </mat-card-content>
            </mat-card>
          </div>
          <div [dbxFlexSize]="2">
            <mat-card appearance="raised">
              <mat-card-content class="dbx-p3">
                <div class="dbx-text-title-medium dbx-mb1">Raised</div>
                <p class="dbx-text-body-medium">Surface lifted by a shadow.</p>
                <dbx-button flat text="Action"></dbx-button>
              </mat-card-content>
            </mat-card>
          </div>
          <div [dbxFlexSize]="2">
            <mat-card appearance="filled">
              <mat-card-content class="dbx-p3">
                <div class="dbx-text-title-medium dbx-mb1">Filled</div>
                <p class="dbx-text-body-medium">Tonal surface container.</p>
                <dbx-button basic text="Action"></dbx-button>
              </mat-card-content>
            </mat-card>
          </div>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoCardsSectionComponent {}
