import { Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { DbxBrowserAgentService, DbxBrowserAgentViewComponent, type DbxBrowserAgentViewConfig, DbxContentBorderDirective, DbxContentContainerDirective, makeDbxBrowserAgentViewConfigFromOsMap, makeDbxBrowserAgentViewEntryForOs } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { type DocExtensionBrowserAgentExampleData, DocExtensionBrowserAgentAndroidExampleComponent, DocExtensionBrowserAgentDefaultExampleComponent, DocExtensionBrowserAgentIosExampleComponent, DocExtensionBrowserAgentWindowsExampleComponent } from '../component/browseragent.example.component';

@Component({
  templateUrl: './browseragent.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, DbxBrowserAgentViewComponent, JsonPipe]
})
export class DocExtensionBrowserAgentComponent {
  readonly agentInfo = inject(DbxBrowserAgentService).agentInfo;

  readonly osMapConfig: DbxBrowserAgentViewConfig = makeDbxBrowserAgentViewConfigFromOsMap({
    ios: { componentClass: DocExtensionBrowserAgentIosExampleComponent },
    android: { componentClass: DocExtensionBrowserAgentAndroidExampleComponent },
    windows: { componentClass: DocExtensionBrowserAgentWindowsExampleComponent },
    default: { componentClass: DocExtensionBrowserAgentDefaultExampleComponent },
    showOverrideButton: true
  });

  readonly customConfig: DbxBrowserAgentViewConfig = {
    entries: [
      {
        key: 'ios-safari',
        label: 'iOS Safari',
        icon: 'phone_iphone',
        match: { os: 'ios', browser: 'safari' },
        componentConfig: {
          componentClass: DocExtensionBrowserAgentIosExampleComponent,
          data: { note: 'The Share button is at the bottom of the screen in Safari.' } as DocExtensionBrowserAgentExampleData
        }
      },
      {
        key: 'ios-chrome',
        label: 'iOS Chrome',
        icon: 'phone_iphone',
        match: { os: 'ios', browser: 'chrome' },
        componentConfig: {
          componentClass: DocExtensionBrowserAgentIosExampleComponent,
          data: { note: 'The Share button is in the address bar in Chrome.' } as DocExtensionBrowserAgentExampleData
        }
      },
      makeDbxBrowserAgentViewEntryForOs('android', { componentClass: DocExtensionBrowserAgentAndroidExampleComponent })
    ],
    defaultEntry: makeDbxBrowserAgentViewEntryForOs('default', { componentClass: DocExtensionBrowserAgentDefaultExampleComponent }),
    showOverrideButton: true
  };

  readonly customOverrideKey = signal<Maybe<string>>(undefined);
}
