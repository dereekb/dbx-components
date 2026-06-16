import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DbxAnchorListComponent, DbxBarDirective, DbxBarHeaderComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxPagebarComponent } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * Style-demo section showing the router-free navigation building blocks — `dbx-pagebar`, `dbx-bar` + `dbx-bar-header`,
 * and a nested `dbx-anchor-list` — painted from the host theme's bar / surface tokens. The anchors are click-only, so
 * this section needs no router; the route-bound `dbx-navbar` demo is contributed by the host app instead.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug style-demo-navigation
 * @dbxDocsUiExampleCategory style-demo
 * @dbxDocsUiExampleSummary Router-free navigation building blocks — pagebar, bar, bar-header, and a nested anchor list.
 * @dbxDocsUiExampleRelated pagebar, bar, bar-header, anchor-list
 */
@Component({
  selector: 'dbx-style-demo-navigation-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxPagebarComponent, DbxBarDirective, DbxBarHeaderComponent, DbxAnchorListComponent, DbxButtonComponent, DbxButtonSpacerDirective],
  template: `
    <dbx-docs-ui-example header="Navigation" hint="Router-free navigation building blocks.">
      <dbx-docs-ui-example-info>
        <p>
          <code>dbx-pagebar</code>
          ,
          <code>dbx-bar</code>
          ,
          <code>dbx-bar-header</code>
          , and
          <code>dbx-anchor-list</code>
          all paint from the host theme's bar / surface tokens. The anchors here are click-only (no
          <code>ref</code>
          ), so the section is router-free; the route-bound
          <code>dbx-navbar</code>
          tab demo is the app-contributed Navbar section.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-flex-column">
          <dbx-pagebar>
            <span left class="dbx-text-title-medium">Page title</span>
            <span right>
              <dbx-button iconOnly icon="search"></dbx-button>
              <dbx-button-spacer></dbx-button-spacer>
              <dbx-button iconOnly icon="more_vert"></dbx-button>
            </span>
          </dbx-pagebar>
          <dbx-bar-header class="dbx-pt2" text="Section divider" icon="folder"></dbx-bar-header>
          <dbx-bar class="dbx-pt2">
            <dbx-button stroked text="Cancel"></dbx-button>
            <dbx-button-spacer></dbx-button-spacer>
            <dbx-button flat color="primary" text="Save"></dbx-button>
          </dbx-bar>
          <dbx-anchor-list class="dbx-pt2" [anchors]="navAnchors"></dbx-anchor-list>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DbxStyleDemoNavigationSectionComponent {
  readonly navAnchors: ClickableAnchorLinkTree[] = [
    { title: 'Dashboard', icon: 'dashboard', onClick: () => undefined },
    {
      title: 'Settings',
      icon: 'settings',
      onClick: () => undefined,
      children: [
        { title: 'Profile', icon: 'person', onClick: () => undefined },
        { title: 'Security', icon: 'lock', onClick: () => undefined }
      ]
    },
    { title: 'Help', icon: 'help', onClick: () => undefined }
  ];
}
