import { type EnvironmentProviders, type Provider, inject, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { type DbxStyleDemoSectionGroup } from '../section/section';
import { DBX_STYLE_DEMO_SECTION_GROUP } from '../section/section.providers';
import { type DbxStyleDemoStyleTemplate } from '../style-loader/style.template';
import { DbxStyleDemoStyleLoaderService } from '../style-loader/style.loader.service';
import { type DbxStyleDemoTemplateToggle } from '../template-toggle/template.toggle';
import { DBX_STYLE_DEMO_TEMPLATE_TOGGLE } from '../template-toggle/template.toggle.providers';
import { DbxStyleDemoCardsSectionComponent } from './cards.section.component';
import { DbxStyleDemoColorTonesSectionComponent } from './color-tones.section.component';
import { DbxStyleDemoTypeRolesSectionComponent } from './type-roles.section.component';

/**
 * The starter set of style-lever templates contributed by `@dereekb/dbx-web/style-demo`.
 *
 * Two `className` levers reference the disposable `.dbx-style-demo-template-*` debug classes (emitted by the
 * `dbx-style-demo-debug-classes()` SCSS mixin); one `style` lever applies an inline CSS-token override directly.
 */
export const DBX_WEB_STYLE_DEMO_TEMPLATES: DbxStyleDemoStyleTemplate[] = [
  { key: 'corner-shape-pill', className: 'dbx-style-demo-template-corner-shape-pill', label: 'Pill corners', curated: true },
  { key: 'surface-tint', className: 'dbx-style-demo-template-surface-tint', label: 'Surface tint', curated: true },
  // Inline-style POJO lever — an intentional demo override value, no debug class needed.
  { key: 'vivid-primary', style: { '--mat-sys-primary': '#ff0066', '--mat-sys-on-primary': '#ffffff' }, label: 'Vivid primary', curated: true }
];

/**
 * The controls levers exposed for {@link DBX_WEB_STYLE_DEMO_TEMPLATES}.
 */
export const DBX_WEB_STYLE_DEMO_TEMPLATE_TOGGLES: DbxStyleDemoTemplateToggle[] = [
  { templateName: 'corner-shape-pill', label: 'Pill corners', group: 'Shape' },
  { templateName: 'surface-tint', label: 'Surface tint', group: 'Surface' },
  { templateName: 'vivid-primary', label: 'Vivid primary', group: 'Color' }
];

/**
 * The `@dereekb/dbx-web/style-demo` section group.
 */
export const DBX_WEB_STYLE_DEMO_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'dbx-web',
  sections: [
    { id: 'dbx-web-cards', title: 'Cards', group: 'cards', tags: ['dbx-web', 'cards', 'surface'], component: DbxStyleDemoCardsSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-color-tones', title: 'Color & Tones', group: 'color', tags: ['dbx-web', 'color'], component: DbxStyleDemoColorTonesSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-type-roles', title: 'Type Roles', group: 'type', tags: ['dbx-web', 'type'], component: DbxStyleDemoTypeRolesSectionComponent, defaultEnabled: true }
  ]
};

/**
 * Registers the `@dereekb/dbx-web/style-demo` sections and style levers with the `<dbx-style-demo>` playground.
 *
 * Contributes the web section group and template toggles via their multi-providers, and seeds the
 * {@link DbxStyleDemoStyleLoaderService} with the matching templates via an environment initializer.
 *
 * Pair with `provideDbxStyleDemo()` (the shell).
 *
 * @returns EnvironmentProviders contributing the web sections and levers.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxWebStyleDemo(): EnvironmentProviders {
  const toggleProviders: Provider[] = DBX_WEB_STYLE_DEMO_TEMPLATE_TOGGLES.map((toggle) => ({
    provide: DBX_STYLE_DEMO_TEMPLATE_TOGGLE,
    useValue: toggle,
    multi: true
  }));

  return makeEnvironmentProviders([
    {
      provide: DBX_STYLE_DEMO_SECTION_GROUP,
      useValue: DBX_WEB_STYLE_DEMO_SECTION_GROUP,
      multi: true
    },
    ...toggleProviders,
    provideEnvironmentInitializer(() => {
      inject(DbxStyleDemoStyleLoaderService).register(DBX_WEB_STYLE_DEMO_TEMPLATES);
    })
  ]);
}
