import { Component, Directive, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { DbxBrowserAgentViewContext } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';

/**
 * Optional data passed to the browser agent example components.
 */
export interface DocExtensionBrowserAgentExampleData {
  readonly note?: Maybe<string>;
}

/**
 * Shows which entry of the parent dbx-browser-agent-view is active.
 */
@Component({
  selector: 'doc-extension-browser-agent-example-status',
  template: `
    <p class="dbx-hint">Showing "{{ context.selectedEntrySignal()?.label }}" ({{ context.isOverriddenSignal() ? 'selected manually' : 'auto-detected' }}). Detected: {{ context.detectedEntrySignal()?.label }}.</p>
  `
})
export class DocExtensionBrowserAgentExampleStatusComponent {
  readonly context = inject(DbxBrowserAgentViewContext);
}

@Directive()
abstract class AbstractDocExtensionBrowserAgentExampleComponent {
  readonly data = inject<Maybe<DocExtensionBrowserAgentExampleData>>(DBX_INJECTION_COMPONENT_DATA, { optional: true });
}

@Component({
  template: `
    <h4>
      <mat-icon>phone_iphone</mat-icon>
      iPhone / iPad
    </h4>
    <ol>
      <li>Tap the Share button.</li>
      <li>Tap "Add to Home Screen".</li>
    </ol>
    @if (data?.note) {
      <p>{{ data?.note }}</p>
    }
    <doc-extension-browser-agent-example-status></doc-extension-browser-agent-example-status>
  `,
  imports: [MatIcon, DocExtensionBrowserAgentExampleStatusComponent]
})
export class DocExtensionBrowserAgentIosExampleComponent extends AbstractDocExtensionBrowserAgentExampleComponent {}

@Component({
  template: `
    <h4>
      <mat-icon>android</mat-icon>
      Android
    </h4>
    <ol>
      <li>Tap the menu button (three dots).</li>
      <li>Tap "Add to Home screen" or "Install app".</li>
    </ol>
    @if (data?.note) {
      <p>{{ data?.note }}</p>
    }
    <doc-extension-browser-agent-example-status></doc-extension-browser-agent-example-status>
  `,
  imports: [MatIcon, DocExtensionBrowserAgentExampleStatusComponent]
})
export class DocExtensionBrowserAgentAndroidExampleComponent extends AbstractDocExtensionBrowserAgentExampleComponent {}

@Component({
  template: `
    <h4>
      <mat-icon>desktop_windows</mat-icon>
      Windows
    </h4>
    <ol>
      <li>Press Ctrl + D to bookmark this page.</li>
      <li>Or use the install button in the address bar.</li>
    </ol>
    @if (data?.note) {
      <p>{{ data?.note }}</p>
    }
    <doc-extension-browser-agent-example-status></doc-extension-browser-agent-example-status>
  `,
  imports: [MatIcon, DocExtensionBrowserAgentExampleStatusComponent]
})
export class DocExtensionBrowserAgentWindowsExampleComponent extends AbstractDocExtensionBrowserAgentExampleComponent {}

@Component({
  template: `
    <h4>
      <mat-icon>laptop_mac</mat-icon>
      Mac
    </h4>
    <ol>
      <li>Press Cmd + D to bookmark this page.</li>
      <li>Or in Safari, choose File &gt; "Add to Dock".</li>
    </ol>
    @if (data?.note) {
      <p>{{ data?.note }}</p>
    }
    <doc-extension-browser-agent-example-status></doc-extension-browser-agent-example-status>
  `,
  imports: [MatIcon, DocExtensionBrowserAgentExampleStatusComponent]
})
export class DocExtensionBrowserAgentMacosExampleComponent extends AbstractDocExtensionBrowserAgentExampleComponent {}

@Component({
  template: `
    <h4>
      <mat-icon>computer</mat-icon>
      Linux
    </h4>
    <ol>
      <li>Press Ctrl + D to bookmark this page.</li>
      <li>Or use the install button in the address bar.</li>
    </ol>
    @if (data?.note) {
      <p>{{ data?.note }}</p>
    }
    <doc-extension-browser-agent-example-status></doc-extension-browser-agent-example-status>
  `,
  imports: [MatIcon, DocExtensionBrowserAgentExampleStatusComponent]
})
export class DocExtensionBrowserAgentLinuxExampleComponent extends AbstractDocExtensionBrowserAgentExampleComponent {}

@Component({
  template: `
    <h4>
      <mat-icon>laptop_chromebook</mat-icon>
      ChromeOS
    </h4>
    <ol>
      <li>Click the install button in the address bar.</li>
      <li>The app opens in its own window and is added to the launcher.</li>
    </ol>
    @if (data?.note) {
      <p>{{ data?.note }}</p>
    }
    <doc-extension-browser-agent-example-status></doc-extension-browser-agent-example-status>
  `,
  imports: [MatIcon, DocExtensionBrowserAgentExampleStatusComponent]
})
export class DocExtensionBrowserAgentChromeosExampleComponent extends AbstractDocExtensionBrowserAgentExampleComponent {}

@Component({
  template: `
    <h4>
      <mat-icon>devices</mat-icon>
      Other Devices
    </h4>
    <p>Bookmark this page in your browser.</p>
    @if (data?.note) {
      <p>{{ data?.note }}</p>
    }
    <doc-extension-browser-agent-example-status></doc-extension-browser-agent-example-status>
  `,
  imports: [MatIcon, DocExtensionBrowserAgentExampleStatusComponent]
})
export class DocExtensionBrowserAgentDefaultExampleComponent extends AbstractDocExtensionBrowserAgentExampleComponent {}
