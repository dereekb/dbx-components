import { Component, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { DbxClickToCopyTextComponent, DbxContentPitDirective, type DbxMcpConnectClient, type DbxMcpConnectClientInstructionsParams } from '@dereekb/dbx-web';

/**
 * Custom instructions content for {@link DOC_EXTENSION_MCP_EXAMPLE_AGENT_CLIENT}, injected by `dbx-mcp-connect-view` after the steps.
 *
 * Reads the server and OAuth client the client passed as the injection config's data.
 */
@Component({
  selector: 'doc-extension-mcp-example-agent-instructions',
  template: `
    <dbx-content-pit>
      <div class="dbx-text-label-medium dbx-mb2">Example Agent link</div>
      <dbx-click-to-copy-text [copyText]="connectUrl">
        <span class="dbx-text-body-small" style="word-break: break-all">{{ connectUrl }}</span>
      </dbx-click-to-copy-text>
      <div class="dbx-hint dbx-text-body-small dbx-mt2">This content is a dbx-injection component that the client added to its instructions.</div>
    </dbx-content-pit>
  `,
  imports: [DbxContentPitDirective, DbxClickToCopyTextComponent]
})
export class DocExtensionMcpExampleAgentInstructionsComponent {
  readonly params = inject<DbxMcpConnectClientInstructionsParams>(DBX_INJECTION_COMPONENT_DATA);

  readonly connectUrl = `example-agent://connect?${new URLSearchParams({ url: this.params.server.url, ...(this.params.oauthClient ? { client_id: this.params.oauthClient.clientId } : {}) }).toString()}`;
}

/**
 * Example of a custom client added through the app's `provideDbxMcpConnectService()` config or a view's `clients`, whose instructions
 * include a dbx-injection component.
 */
export const DOC_EXTENSION_MCP_EXAMPLE_AGENT_CLIENT: DbxMcpConnectClient = {
  id: 'example-agent',
  label: 'Example Agent',
  instructions: (params) => ({
    steps: ['Open Example Agent and go to Settings > Integrations.', 'Click Add from link, paste the link below, and sign in.'],
    injection: { componentClass: DocExtensionMcpExampleAgentInstructionsComponent, data: params }
  })
};
