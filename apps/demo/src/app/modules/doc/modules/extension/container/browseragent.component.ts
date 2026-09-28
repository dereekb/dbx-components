import { Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { DbxBrowserAgentService, DbxBrowserAgentViewComponent, type DbxBrowserAgentViewConfig, DbxContentBorderDirective, DbxContentContainerDirective, makeDbxBrowserAgentViewConfigFromOsMap, makeDbxBrowserAgentViewEntryForOs } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import {
  type DocExtensionBrowserAgentExampleData,
  DocExtensionBrowserAgentAndroidExampleComponent,
  DocExtensionBrowserAgentChromeosExampleComponent,
  DocExtensionBrowserAgentDefaultExampleComponent,
  DocExtensionBrowserAgentIosExampleComponent,
  DocExtensionBrowserAgentLinuxExampleComponent,
  DocExtensionBrowserAgentMacosExampleComponent,
  DocExtensionBrowserAgentWindowsExampleComponent
} from '../component/browseragent.example.component';

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
    macos: { componentClass: DocExtensionBrowserAgentMacosExampleComponent },
    linux: { componentClass: DocExtensionBrowserAgentLinuxExampleComponent },
    chromeos: { componentClass: DocExtensionBrowserAgentChromeosExampleComponent },
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
      makeDbxBrowserAgentViewEntryForOs('android', { componentClass: DocExtensionBrowserAgentAndroidExampleComponent }),
      {
        key: 'macos-safari',
        label: 'Mac Safari',
        icon: 'laptop_mac',
        match: { os: 'macos', browser: 'safari' },
        componentConfig: {
          componentClass: DocExtensionBrowserAgentMacosExampleComponent,
          data: { note: 'Safari can add this page to the Dock as a web app.' } as DocExtensionBrowserAgentExampleData
        }
      },
      makeDbxBrowserAgentViewEntryForOs('macos', {
        componentConfig: {
          componentClass: DocExtensionBrowserAgentMacosExampleComponent,
          data: { note: 'Chrome and Edge show an install button in the address bar.' } as DocExtensionBrowserAgentExampleData
        },
        label: 'Mac (Other Browsers)'
      })
    ],
    defaultEntry: makeDbxBrowserAgentViewEntryForOs('default', { componentClass: DocExtensionBrowserAgentDefaultExampleComponent }),
    showOverrideButton: true
  };

  readonly customOverrideKey = signal<Maybe<string>>(undefined);
}
