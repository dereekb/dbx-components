import { Component } from '@angular/core';
import {
  CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT,
  CURSOR_DBX_MCP_CONNECT_CLIENT,
  DbxContentContainerDirective,
  type DbxMcpConnectClient,
  DbxMcpConnectButtonComponent,
  type DbxMcpConnectButtonConfig,
  type DbxMcpConnectOAuthClient,
  type DbxMcpConnectServer,
  DbxMcpConnectViewComponent,
  GROK_DBX_MCP_CONNECT_CLIENT
} from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DOC_EXTENSION_MCP_EXAMPLE_AGENT_CLIENT } from '../component/mcp.example.client.component';

/**
 * Demo page for the MCP connect button and view.
 */
@Component({
  templateUrl: './mcp.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxMcpConnectButtonComponent, DbxMcpConnectViewComponent]
})
export class DocExtensionMcpComponent {
  readonly styledButtonConfig: DbxMcpConnectButtonConfig = {
    header: 'Connect your AI assistant to the demo',
    buttonStyle: { type: 'raised', color: 'primary' }
  };

  readonly exampleServer: DbxMcpConnectServer = {
    url: 'https://api.example.com/mcp',
    label: 'Example App'
  };

  readonly exampleClients: DbxMcpConnectClient[] = [CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, CURSOR_DBX_MCP_CONNECT_CLIENT, GROK_DBX_MCP_CONNECT_CLIENT];

  readonly exampleOAuthClient: DbxMcpConnectOAuthClient = {
    clientId: 'h5Nq2xWc8kYb3TzR',
    clientSecret: 'example-client-secret-Jm4Vp9Lr2Qs7'
  };

  readonly exampleCustomClients: DbxMcpConnectClient[] = [CLAUDE_CODE_DBX_MCP_CONNECT_CLIENT, DOC_EXTENSION_MCP_EXAMPLE_AGENT_CLIENT];
}
