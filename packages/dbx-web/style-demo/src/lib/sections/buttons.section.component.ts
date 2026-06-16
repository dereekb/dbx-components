import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxThemeColor, DbxButtonComponent, DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * One Material button appearance shown in the {@link DbxStyleDemoButtonsSectionComponent} grid.
 */
type DbxStyleDemoButtonVariant = 'basic' | 'stroked' | 'flat' | 'raised' | 'tonal';

/**
 * Style-demo section showing every `dbx-button` appearance (basic, stroked, flat, raised, tonal) across the core
 * theme colors, plus an icon-only and a FAB button. Buttons paint their container colour and corner radius from the
 * `--mat-button-*` tokens, so they respond live to the playground's Shape levers and flip with light/dark.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-buttons
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary dbx-button appearances across theme colors, plus icon-only and FAB modes.
 * @dbxDocsUiExampleRelated button, icon-button
 */
@Component({
  selector: 'dbx-style-demo-buttons-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxButtonComponent, DbxButtonSpacerDirective],
  template: `
    <dbx-docs-ui-example header="Buttons" hint="dbx-button appearances across theme colors.">
      <dbx-docs-ui-example-info>
        <p>
          Each row is one Material button appearance —
          <code>basic</code>
          ,
          <code>stroked</code>
          ,
          <code>flat</code>
          ,
          <code>raised</code>
          ,
          <code>tonal</code>
          — rendered across the core theme colors. Buttons draw their container colour and corner radius from the
          <code>--mat-button-*</code>
          tokens, so they respond live to the Shape levers and flip with light/dark.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-flex-column">
          @for (variant of variants; track variant) {
            <div class="dbx-pb2">
              <div class="dbx-text-label-small dbx-hint dbx-pb1">{{ variant }}</div>
              <div class="dbx-flex">
                @for (color of colors; track color; let last = $last) {
                  <dbx-button [basic]="variant === 'basic'" [stroked]="variant === 'stroked'" [flat]="variant === 'flat'" [raised]="variant === 'raised'" [tonal]="variant === 'tonal'" [color]="color" [text]="color ?? 'default'"></dbx-button>
                  @if (!last) {
                    <dbx-button-spacer></dbx-button-spacer>
                  }
                }
              </div>
            </div>
          }
          <div class="dbx-flex">
            <dbx-button iconOnly icon="palette"></dbx-button>
            <dbx-button-spacer></dbx-button-spacer>
            <dbx-button fab icon="add"></dbx-button>
          </div>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoButtonsSectionComponent {
  readonly variants: DbxStyleDemoButtonVariant[] = ['basic', 'stroked', 'flat', 'raised', 'tonal'];
  readonly colors: Maybe<DbxThemeColor>[] = [undefined, 'primary', 'accent', 'warn', 'success'];
}
