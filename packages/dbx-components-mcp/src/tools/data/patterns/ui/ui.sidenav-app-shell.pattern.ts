import type { UiExamplePattern } from '../ui-patterns.js';

export const UI_PATTERN_SIDENAV_APP_SHELL: UiExamplePattern = {
  slug: 'sidenav-app-shell',
  name: 'Sidenav app shell',
  summary: 'Top-level app shell with a left sidenav and content area driven by UIRouter.',
  usesUiSlugs: ['sidenav-page', 'sidenav', 'content-page'],
  snippets: {
    minimal: `<dbx-sidenav-page>
  <dbx-sidenav [anchors]="navAnchors"></dbx-sidenav>
  <ui-view></ui-view>
</dbx-sidenav-page>`,
    brief: `<dbx-sidenav-page>
  <dbx-sidenav [anchors]="navAnchors"></dbx-sidenav>
  <div dbxContentPage>
    <ui-view></ui-view>
  </div>
</dbx-sidenav-page>`,
    full: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { DbxSidenavPageComponent, DbxSidenavComponent, DbxContentPageDirective } from '@dereekb/dbx-web';
import { UIRouterModule } from '@uirouter/angular';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [DbxSidenavPageComponent, DbxSidenavComponent, DbxContentPageDirective, UIRouterModule],
  template: \`
    <dbx-sidenav-page>
      <dbx-sidenav [anchors]="navAnchors"></dbx-sidenav>
      <div dbxContentPage>
        <ui-view></ui-view>
      </div>
    </dbx-sidenav-page>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  readonly navAnchors: ClickableAnchor[] = [
    { ref: 'app.home', icon: 'home', title: 'Home' },
    { ref: 'app.members', icon: 'group', title: 'Members' },
    { ref: 'app.settings', icon: 'settings', title: 'Settings' }
  ];
}`
  },
  notes: 'Pair with `dbx-navbar` for top-level horizontal nav. See the `dbx__guide__app-states` skill for state tree scaffolding.'
};
