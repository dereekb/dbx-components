import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type DbxThemeColor, DbxColorDirective, DbxFlexGroupDirective, DbxFlexSizeDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * Style-demo section showing `[dbxColor]` themed backgrounds at full strength and as `[dbxColorTone]` tonal washes,
 * across the core and extra theme colors, so the color tokens are easy to compare under the host app's theme.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-color-tones
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary Themed [dbxColor] backgrounds at full strength and as [dbxColorTone] tonal washes.
 * @dbxDocsUiExampleRelated color, text-color, color-service
 */
@Component({
  selector: 'dbx-style-demo-color-tones-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxColorDirective, DbxFlexGroupDirective, DbxFlexSizeDirective],
  template: `
    <dbx-docs-ui-example header="Color & Tones" hint="Themed [dbxColor] backgrounds, full and tonal.">
      <dbx-docs-ui-example-info>
        <p>
          <code>[dbxColor]</code>
          paints an element from a named theme color token; adding
          <code>[dbxColorTone]</code>
          (0–100) mixes it toward the surface for a muted tonal wash. Each swatch below is shown full strength and at a tone of 18, so the same token reads correctly under any theme.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div dbxFlexGroup>
          @for (color of colors; track color) {
            <div [dbxFlexSize]="3">
              <div class="dbx-p3 dbx-mb1" [dbxColor]="color">
                <span class="dbx-text-label-large">{{ color }}</span>
              </div>
              <div class="dbx-p3" [dbxColor]="color" [dbxColorTone]="18">
                <span class="dbx-text-label-large">{{ color }} · tone 18</span>
              </div>
            </div>
          }
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoColorTonesSectionComponent {
  readonly colors: DbxThemeColor[] = ['primary', 'secondary', 'tertiary', 'warn', 'success', 'notice'];
}
