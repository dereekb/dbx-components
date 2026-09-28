import { Service } from '@angular/core';
import { type BrowserAgentInfo, getCurrentBrowserAgentInfo } from '@dereekb/browser';

/**
 * Provides the {@link BrowserAgentInfo} of the current browser.
 *
 * Replace this service to provide a fixed browser agent in tests or demos.
 *
 * @example
 * ```typescript
 * providers: [{ provide: DbxBrowserAgentService, useValue: { agentInfo: parseBrowserAgentInfo({ userAgent }) } }]
 * ```
 */
@Service()
export class DbxBrowserAgentService {
  readonly agentInfo: BrowserAgentInfo = getCurrentBrowserAgentInfo();
}
