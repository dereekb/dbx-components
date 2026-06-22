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
 * The five `corner-shape-*` levers, the controls-only `pill-controls`, the component-scoped `button-corner-*` /
 * `list-corner-*` / `anchor-list-corner-*` levers, and `surface-tint` reference the disposable
 * `.dbx-style-demo-template-*` debug classes (emitted by the `dbx-style-demo-debug-classes()` SCSS mixin); the
 * `vivid-primary` `style` lever applies an inline CSS-token override directly. The `corner-shape-*` levers share the
 * `'Shape'` toggle group, so only one is active at a time; `pill-controls` (`'Controls'`), `button-corner-*`
 * (`'Button Shape'`), `list-corner-*` (`'List Shape'`) and `anchor-list-corner-*` (`'Anchor List Shape'`) each live in
 * their own group so they compose on top of a corner lever instead of radio-excluding it — their debug classes are
 * emitted after `corner-shape-*` / `pill-controls` so they win the shape tokens they share. The `sidenav-corner-*`
 * levers (`'Sidenav Shape'`) re-round the nested `mat-sidenav` drawer's own trailing-edge tokens and are independent
 * of every other shape lever.
 */
export const DBX_WEB_STYLE_DEMO_TEMPLATES: DbxStyleDemoStyleTemplate[] = [
  { key: 'corner-shape-none', className: 'dbx-style-demo-template-corner-shape-none', label: 'Corners: none', curated: true },
  { key: 'corner-shape-extra-small', className: 'dbx-style-demo-template-corner-shape-extra-small', label: 'Corners: extra-small', curated: true },
  { key: 'corner-shape-medium', className: 'dbx-style-demo-template-corner-shape-medium', label: 'Corners: medium', curated: true },
  { key: 'corner-shape-large', className: 'dbx-style-demo-template-corner-shape-large', label: 'Corners: large', curated: true },
  { key: 'corner-shape-extra-large', className: 'dbx-style-demo-template-corner-shape-extra-large', label: 'Corners: extra-large', curated: true },
  { key: 'pill-controls', className: 'dbx-style-demo-template-pill-controls', label: 'Pill controls', curated: true },
  // Button-only corner levers ('Button Shape' group) — compose on top of a corner-shape-* lever.
  { key: 'button-corner-none', className: 'dbx-style-demo-template-button-corner-none', label: 'Button corners: none', curated: true },
  { key: 'button-corner-extra-small', className: 'dbx-style-demo-template-button-corner-extra-small', label: 'Button corners: extra-small', curated: true },
  { key: 'button-corner-medium', className: 'dbx-style-demo-template-button-corner-medium', label: 'Button corners: medium', curated: true },
  { key: 'button-corner-large', className: 'dbx-style-demo-template-button-corner-large', label: 'Button corners: large', curated: true },
  { key: 'button-corner-extra-large', className: 'dbx-style-demo-template-button-corner-extra-large', label: 'Button corners: extra-large', curated: true },
  // dbx-list-only corner levers ('List Shape' group) — re-round selection/standard + card list rows.
  { key: 'list-corner-none', className: 'dbx-style-demo-template-list-corner-none', label: 'List corners: none', curated: true },
  { key: 'list-corner-small', className: 'dbx-style-demo-template-list-corner-small', label: 'List corners: small', curated: true },
  { key: 'list-corner-medium', className: 'dbx-style-demo-template-list-corner-medium', label: 'List corners: medium', curated: true },
  { key: 'list-corner-large', className: 'dbx-style-demo-template-list-corner-large', label: 'List corners: large', curated: true },
  { key: 'list-corner-extra-large', className: 'dbx-style-demo-template-list-corner-extra-large', label: 'List corners: extra-large', curated: true },
  // dbx-anchor-list-only corner levers ('Anchor List Shape' group) — re-round nav/anchor list rows, independent of List Shape.
  { key: 'anchor-list-corner-none', className: 'dbx-style-demo-template-anchor-list-corner-none', label: 'Anchor list corners: none', curated: true },
  { key: 'anchor-list-corner-small', className: 'dbx-style-demo-template-anchor-list-corner-small', label: 'Anchor list corners: small', curated: true },
  { key: 'anchor-list-corner-medium', className: 'dbx-style-demo-template-anchor-list-corner-medium', label: 'Anchor list corners: medium', curated: true },
  { key: 'anchor-list-corner-large', className: 'dbx-style-demo-template-anchor-list-corner-large', label: 'Anchor list corners: large', curated: true },
  { key: 'anchor-list-corner-extra-large', className: 'dbx-style-demo-template-anchor-list-corner-extra-large', label: 'Anchor list corners: extra-large', curated: true },
  // dbx-sidenav drawer trailing-edge corner levers ('Sidenav Shape' group) — re-round the nested mat-sidenav edge.
  { key: 'sidenav-corner-none', className: 'dbx-style-demo-template-sidenav-corner-none', label: 'Sidenav corners: none', curated: true },
  { key: 'sidenav-corner-medium', className: 'dbx-style-demo-template-sidenav-corner-medium', label: 'Sidenav corners: medium', curated: true },
  { key: 'sidenav-corner-extra', className: 'dbx-style-demo-template-sidenav-corner-extra', label: 'Sidenav corners: extra', curated: true },
  { key: 'surface-tint', className: 'dbx-style-demo-template-surface-tint', label: 'Surface tint', curated: true },
  // Inline-style POJO lever — an intentional demo override value, no debug class needed.
  { key: 'vivid-primary', style: { '--mat-sys-primary': '#ff0066', '--mat-sys-on-primary': '#ffffff' }, label: 'Vivid primary', curated: true }
];

/**
 * The controls levers exposed for {@link DBX_WEB_STYLE_DEMO_TEMPLATES}.
 *
 * The `corner-shape-*` levers share the `'Shape'` group (mutually exclusive); the component-scoped `button-corner-*`
 * (`'Button Shape'`), `list-corner-*` (`'List Shape'`) and `anchor-list-corner-*` (`'Anchor List Shape'`) levers are
 * mutually exclusive within their own groups but compose with `'Shape'` and `'Controls'`, letting a global corner
 * preset be overridden for just buttons, just `dbx-list` rows, or just `dbx-anchor-list` (nav) rows. The
 * `sidenav-corner-*` levers (`'Sidenav Shape'`) re-round the `dbx-sidenav` drawer edge independently. `pill-controls`
 * (`'Controls'`), `surface-tint` and `vivid-primary` are independent toggles in their own groups.
 */
export const DBX_WEB_STYLE_DEMO_TEMPLATE_TOGGLES: DbxStyleDemoTemplateToggle[] = [
  { templateName: 'corner-shape-none', label: 'Corners: none', group: 'Shape' },
  { templateName: 'corner-shape-extra-small', label: 'Corners: extra-small', group: 'Shape' },
  { templateName: 'corner-shape-medium', label: 'Corners: medium', group: 'Shape' },
  { templateName: 'corner-shape-large', label: 'Corners: large', group: 'Shape' },
  { templateName: 'corner-shape-extra-large', label: 'Corners: extra-large', group: 'Shape' },
  { templateName: 'pill-controls', label: 'Pill controls', group: 'Controls' },
  { templateName: 'button-corner-none', label: 'Button corners: none', group: 'Button Shape' },
  { templateName: 'button-corner-extra-small', label: 'Button corners: extra-small', group: 'Button Shape' },
  { templateName: 'button-corner-medium', label: 'Button corners: medium', group: 'Button Shape' },
  { templateName: 'button-corner-large', label: 'Button corners: large', group: 'Button Shape' },
  { templateName: 'button-corner-extra-large', label: 'Button corners: extra-large', group: 'Button Shape' },
  { templateName: 'list-corner-none', label: 'List corners: none', group: 'List Shape' },
  { templateName: 'list-corner-small', label: 'List corners: small', group: 'List Shape' },
  { templateName: 'list-corner-medium', label: 'List corners: medium', group: 'List Shape' },
  { templateName: 'list-corner-large', label: 'List corners: large', group: 'List Shape' },
  { templateName: 'list-corner-extra-large', label: 'List corners: extra-large', group: 'List Shape' },
  { templateName: 'anchor-list-corner-none', label: 'Anchor list corners: none', group: 'Anchor List Shape' },
  { templateName: 'anchor-list-corner-small', label: 'Anchor list corners: small', group: 'Anchor List Shape' },
  { templateName: 'anchor-list-corner-medium', label: 'Anchor list corners: medium', group: 'Anchor List Shape' },
  { templateName: 'anchor-list-corner-large', label: 'Anchor list corners: large', group: 'Anchor List Shape' },
  { templateName: 'anchor-list-corner-extra-large', label: 'Anchor list corners: extra-large', group: 'Anchor List Shape' },
  { templateName: 'sidenav-corner-none', label: 'Sidenav corners: none', group: 'Sidenav Shape' },
  { templateName: 'sidenav-corner-medium', label: 'Sidenav corners: medium', group: 'Sidenav Shape' },
  { templateName: 'sidenav-corner-extra', label: 'Sidenav corners: extra', group: 'Sidenav Shape' },
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
