import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * A single M3 typescale role rendered in the {@link DbxStyleDemoTypeRolesSectionComponent} sample.
 */
interface DbxStyleDemoTypeRole {
  readonly cssClass: string;
  readonly label: string;
}

/**
 * Style-demo section showing the Material 3 typescale roles via the `.dbx-text-<role>` utility classes, so the
 * host theme's type ramp (family, size, weight, tracking) is visible at a glance.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-type-roles
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary Material 3 typescale roles rendered via the .dbx-text-<role> utility classes.
 * @dbxDocsUiExampleRelated text
 */
@Component({
  selector: 'dbx-style-demo-type-roles-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent],
  template: `
    <dbx-docs-ui-example header="Type Roles" hint="Material 3 typescale via .dbx-text-* utilities.">
      <dbx-docs-ui-example-info>
        <p>
          The
          <code>.dbx-text-&lt;role&gt;</code>
          utilities map to the M3 typescale tokens (
          <code>--mat-sys-headline-large</code>
          ,
          <code>--mat-sys-title-medium</code>
          , …). They inherit the host theme's plain/brand families and weights, so a downstream app changing its typography ramp updates every role here without any local font rules.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-flex-column">
          @for (role of roles; track role.cssClass) {
            <div class="dbx-pb1" [class]="role.cssClass">{{ role.label }}</div>
          }
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoTypeRolesSectionComponent {
  readonly roles: DbxStyleDemoTypeRole[] = [
    { cssClass: 'dbx-text-display-small', label: 'Display Small' },
    { cssClass: 'dbx-text-headline-medium', label: 'Headline Medium' },
    { cssClass: 'dbx-text-title-large', label: 'Title Large' },
    { cssClass: 'dbx-text-body-large', label: 'Body Large — the quick brown fox jumps over the lazy dog.' },
    { cssClass: 'dbx-text-label-medium', label: 'Label Medium' }
  ];
}
