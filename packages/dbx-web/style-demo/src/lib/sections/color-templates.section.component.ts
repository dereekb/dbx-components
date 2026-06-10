import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxColorDirective, DbxColorService } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * A registered color template surfaced as a swatch in the {@link DbxStyleDemoColorTemplatesSectionComponent}.
 */
interface DbxStyleDemoColorTemplate {
  readonly key: string;
  readonly curated: boolean;
}

/**
 * Style-demo section that dumps every template registered with the host app's {@link DbxColorService} as a
 * `[dbxColor]` swatch, marking the curated ones. This makes both the built-in curated set and any app-seeded
 * templates visible in one place; when the service is not provided, an empty-state hint is shown instead.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-color-templates
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary Every registered DbxColorService template dumped as a [dbxColor] swatch, curated ones marked.
 * @dbxDocsUiExampleRelated color, color-service
 */
@Component({
  selector: 'dbx-style-demo-color-templates-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxColorDirective],
  template: `
    <dbx-docs-ui-example header="Color Templates" hint="Registered DbxColorService templates.">
      <dbx-docs-ui-example-info>
        <p>
          A
          <code>DbxColorConfigTemplate</code>
          is a named, reusable color preset registered with
          <code>DbxColorService</code>
          — via
          <code>provideDbxStyleService(&#123; dbxColorServiceConfig: &#123; templates &#125; &#125;)</code>
          at the app root or
          <code>DbxColorService.register(...)</code>
          at runtime. Each swatch below is painted with
          <code>[dbxColor]="&#123; template: key &#125;"</code>
          ; the
          <code>curated</code>
          ones also feed the deterministic name-derived color pickers.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        @if (templates.length > 0) {
          <div class="dbx-flex" [style.flex-wrap]="'wrap'">
            @for (template of templates; track template.key) {
              <div class="dbx-pr1 dbx-pb1">
                <div class="dbx-p2" [dbxColor]="{ template: template.key }">
                  <span class="dbx-text-label-small">{{ template.key }}</span>
                  @if (template.curated) {
                    <span class="dbx-text-label-small">· curated</span>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <p class="dbx-hint">No DbxColorService templates are registered (or the service is not provided by the host app).</p>
        }
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoColorTemplatesSectionComponent {
  private readonly _colorService = inject(DbxColorService, { optional: true });

  readonly templates: DbxStyleDemoColorTemplate[] = (this._colorService?.getAllRegisteredTemplateKeys() ?? []).map((key) => ({ key, curated: this._colorService?.getTemplate(key)?.curated === true }));
}
