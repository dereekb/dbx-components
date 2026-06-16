import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ClickableAnchorLinkSegueRef } from '@dereekb/dbx-core';
import { DbxNavbarComponent } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleContentComponent, DbxDocsUiExampleInfoComponent } from '@dereekb/dbx-web/docs';

/**
 * Demo-app-contributed style-demo section showing a route-bound `dbx-navbar`.
 *
 * Unlike the router-free navigation building blocks contributed by `@dereekb/dbx-web/style-demo`, the navbar needs
 * real UIRouter state refs (it selects its active tab from the current route and navigates on click), so it can only
 * be demonstrated by the host app. The anchors point at the sibling `doc.examples.*` states; because the playground
 * lives at `doc.examples.playground`, the Playground tab renders as selected.
 */
@Component({
  selector: 'doc-style-demo-navbar-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxNavbarComponent],
  template: `
    <dbx-docs-ui-example header="Navbar (demo app)" hint="Route-bound dbx-navbar tabs.">
      <dbx-docs-ui-example-info>
        <p>
          <code>dbx-navbar</code>
          renders anchor links as Material tabs and binds them to UIRouter: it selects the active tab from the current route and navigates on click. That requires real state refs, so the navbar demo is contributed by the host app rather than the library. The tabs below point at the sibling
          <code>doc.examples.*</code>
          states, so the Playground tab shows as selected here.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <dbx-navbar [anchors]="navAnchors" [breakpoint]="'small'"></dbx-navbar>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocStyleDemoNavbarSectionComponent {
  readonly navAnchors: ClickableAnchorLinkSegueRef[] = [
    { title: 'Home', ref: 'doc.examples.home' },
    { title: 'List', ref: 'doc.examples.list' },
    { title: 'Card', ref: 'doc.examples.card' },
    { title: 'Action', ref: 'doc.examples.action' },
    { title: 'Layout', ref: 'doc.examples.layout' },
    { title: 'Playground', ref: 'doc.examples.playground' }
  ];
}
