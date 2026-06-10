import { type EnvironmentProviders, type Provider, inject, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { type DbxStyleDemoSectionGroup } from '../section/section';
import { DBX_STYLE_DEMO_SECTION_GROUP } from '../section/section.providers';
import { type DbxStyleDemoStyleTemplate } from '../style-loader/style.template';
import { DbxStyleDemoStyleLoaderService } from '../style-loader/style.loader.service';
import { type DbxStyleDemoTemplateToggle } from '../template-toggle/template.toggle';
import { DBX_STYLE_DEMO_TEMPLATE_TOGGLE } from '../template-toggle/template.toggle.providers';
import { DbxStyleDemoButtonsSectionComponent } from './buttons.section.component';
import { DbxStyleDemoCardsSectionComponent } from './cards.section.component';
import { DbxStyleDemoColorTemplatesSectionComponent } from './color-templates.section.component';
import { DbxStyleDemoColorTonesSectionComponent } from './color-tones.section.component';
import { DbxStyleDemoNavigationSectionComponent } from './navigation.section.component';
import { DbxStyleDemoShapeScaleSectionComponent } from './shape-scale.section.component';
import { DbxStyleDemoSurfacesSectionComponent } from './surfaces.section.component';
import { DbxStyleDemoTypeRolesSectionComponent } from './type-roles.section.component';

/**
 * The starter set of style-lever templates contributed by `@dereekb/dbx-web/style-demo`.
 *
 * The six `corner-shape-*` levers plus `surface-tint` reference the disposable `.dbx-style-demo-template-*` debug
 * classes (emitted by the `dbx-style-demo-debug-classes()` SCSS mixin); the `vivid-primary` `style` lever applies an
 * inline CSS-token override directly. The `corner-shape-*` levers share the `'Shape'` toggle group, so only one is
 * active at a time.
 */
export const DBX_WEB_STYLE_DEMO_TEMPLATES: DbxStyleDemoStyleTemplate[] = [
  { key: 'corner-shape-none', className: 'dbx-style-demo-template-corner-shape-none', label: 'Corners: none', curated: true },
  { key: 'corner-shape-extra-small', className: 'dbx-style-demo-template-corner-shape-extra-small', label: 'Corners: extra-small', curated: true },
  { key: 'corner-shape-medium', className: 'dbx-style-demo-template-corner-shape-medium', label: 'Corners: medium', curated: true },
  { key: 'corner-shape-large', className: 'dbx-style-demo-template-corner-shape-large', label: 'Corners: large', curated: true },
  { key: 'corner-shape-extra-large', className: 'dbx-style-demo-template-corner-shape-extra-large', label: 'Corners: extra-large', curated: true },
  { key: 'corner-shape-full', className: 'dbx-style-demo-template-corner-shape-full', label: 'Corners: full', curated: true },
  { key: 'surface-tint', className: 'dbx-style-demo-template-surface-tint', label: 'Surface tint', curated: true },
  // Inline-style POJO lever — an intentional demo override value, no debug class needed.
  { key: 'vivid-primary', style: { '--mat-sys-primary': '#ff0066', '--mat-sys-on-primary': '#ffffff' }, label: 'Vivid primary', curated: true }
];

/**
 * The controls levers exposed for {@link DBX_WEB_STYLE_DEMO_TEMPLATES}.
 *
 * The `corner-shape-*` levers share the `'Shape'` group (mutually exclusive); `surface-tint` and `vivid-primary`
 * are independent toggles in their own groups.
 */
export const DBX_WEB_STYLE_DEMO_TEMPLATE_TOGGLES: DbxStyleDemoTemplateToggle[] = [
  { templateName: 'corner-shape-none', label: 'Corners: none', group: 'Shape' },
  { templateName: 'corner-shape-extra-small', label: 'Corners: extra-small', group: 'Shape' },
  { templateName: 'corner-shape-medium', label: 'Corners: medium', group: 'Shape' },
  { templateName: 'corner-shape-large', label: 'Corners: large', group: 'Shape' },
  { templateName: 'corner-shape-extra-large', label: 'Corners: extra-large', group: 'Shape' },
  { templateName: 'corner-shape-full', label: 'Corners: full', group: 'Shape' },
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
    { id: 'dbx-web-buttons', title: 'Buttons', group: 'buttons', tags: ['dbx-web', 'button'], component: DbxStyleDemoButtonsSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-surfaces', title: 'Surfaces', group: 'surface', tags: ['dbx-web', 'surface'], component: DbxStyleDemoSurfacesSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-color-tones', title: 'Color & Tones', group: 'color', tags: ['dbx-web', 'color'], component: DbxStyleDemoColorTonesSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-color-templates', title: 'Color Templates', group: 'color', tags: ['dbx-web', 'color'], component: DbxStyleDemoColorTemplatesSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-type-roles', title: 'Type Roles', group: 'type', tags: ['dbx-web', 'type'], component: DbxStyleDemoTypeRolesSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-shape-scale', title: 'Shape Scale', group: 'shape', tags: ['dbx-web', 'shape'], component: DbxStyleDemoShapeScaleSectionComponent, defaultEnabled: true },
    { id: 'dbx-web-navigation', title: 'Navigation', group: 'navigation', tags: ['dbx-web', 'navigation'], component: DbxStyleDemoNavigationSectionComponent, defaultEnabled: true }
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
