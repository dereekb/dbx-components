import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { MatButtonToggle, type MatButtonToggleChange, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { type ClickableUrl, clickableUrlInNewTab, DbxInjectionComponent } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '../../button/button.component';
import { type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig } from '../../util/clipboard';
import { DbxClickToCopyTextComponent } from '../../layout/text/copy.text.component';
import { DbxClickToCopyFieldComponent, DEFAULT_DBX_CLICK_TO_COPY_FIELD_HIDDEN_TEXT } from '../../layout/text/copy.field.component';
import { DbxStepBlockComponent } from '../../layout/text/step.block.component';
import { DbxAnchorComponent } from '../../router/layout/anchor/anchor.component';
import { DBX_MCP_CONNECT_SERVER, DEFAULT_DBX_MCP_CONNECT_CLIENTS, type DbxMcpConnectClient, type DbxMcpConnectClientId, type DbxMcpConnectOAuthClient, type DbxMcpConnectServer, isConfidentialDbxMcpConnectOAuthClient } from './mcp.connect';
import { DbxMcpConnectService } from './mcp.connect.service';

/**
 * Hint shown above the MCP server url by {@link DbxMcpConnectViewComponent} when no hint is configured.
 */
export const DEFAULT_DBX_MCP_CONNECT_VIEW_HINT = 'Add this server to your AI assistant, then sign in to give it access to your account.';

/**
 * Config for {@link DbxMcpConnectViewComponent}. The component's individual inputs take precedence.
 */
export interface DbxMcpConnectViewConfig {
  /**
   * The server to connect to. Defaults to the server provided by {@link DBX_MCP_CONNECT_SERVER}.
   */
  readonly server?: Maybe<DbxMcpConnectServer>;
  /**
   * The pre-registered OAuth client the assistant signs in with. Its id and secret are shown with the server url and used in each client's
   * instructions. Defaults to the server's {@link DbxMcpConnectServer.oauthClient}.
   *
   * Leave unset when the server offers dynamic client registration and the assistants register themselves.
   */
  readonly oauthClient?: Maybe<DbxMcpConnectOAuthClient>;
  /**
   * Clients to show instructions for, in display order. Defaults to the app's clients from {@link DbxMcpConnectService}, or
   * {@link DEFAULT_DBX_MCP_CONNECT_CLIENTS} when the app does not provide the service.
   */
  readonly clients?: Maybe<DbxMcpConnectClient[]>;
  /**
   * Id of the client selected at first. Defaults to the app's default client from {@link DbxMcpConnectService}, then the first client.
   */
  readonly defaultClientId?: Maybe<DbxMcpConnectClientId>;
  /**
   * Hint shown above the server url. Defaults to {@link DEFAULT_DBX_MCP_CONNECT_VIEW_HINT}. Pass an empty string to hide it.
   */
  readonly hint?: Maybe<string>;
}

/**
 * Shows an MCP server's url and short instructions for connecting AI assistants, such as Claude, Claude Code, ChatGPT, Cursor, and VS Code, to it.
 *
 * The server comes from the `server` input, then the `config` input, then the app's {@link DBX_MCP_CONNECT_SERVER}. Apps that call
 * `provideDbxFirebaseOidc()` provide that token, so the view needs no inputs there.
 *
 * The clients come from the `clients` input, then the `config` input, then the app's {@link DbxMcpConnectService} from
 * `provideDbxMcpConnectService()`, then {@link DEFAULT_DBX_MCP_CONNECT_CLIENTS}.
 *
 * Pass an `oauthClient` when the assistants must sign in with a pre-registered OAuth client. The view then shows its client id and secret,
 * hiding the secret until the user reveals it, and each client's instructions say where to enter them.
 *
 * @dbxWebComponent
 * @dbxWebSlug mcp-connect-view
 * @dbxWebCategory misc
 * @dbxWebRelated mcp-connect-button, click-to-copy-text
 * @dbxWebMinimalExample ```html
 * <dbx-mcp-connect-view></dbx-mcp-connect-view>
 * ```
 *
 * @example
 * ```html
 * <dbx-mcp-connect-view [server]="{ url: 'https://api.example.com/mcp', label: 'Example' }" [oauthClient]="{ clientId: 'abc123' }" [clients]="clients"></dbx-mcp-connect-view>
 * ```
 */
@Component({
  selector: 'dbx-mcp-connect-view',
  template: `
    @if (hintSignal()) {
      <p class="dbx-mcp-connect-view-hint">{{ hintSignal() }}</p>
    }
    <div class="dbx-mcp-connect-view-label dbx-text-label-medium">MCP server URL</div>
    @if (serverSignal(); as server) {
      <dbx-click-to-copy-field icon="link" [monospace]="true" [text]="server.url" [clipboardSnackbarMessagesConfig]="urlClipboardSnackbarMessagesConfig"></dbx-click-to-copy-field>
      @if (oauthClientSignal(); as oauthClient) {
        <div class="dbx-mcp-connect-view-label dbx-text-label-medium">Client ID</div>
        <dbx-click-to-copy-field icon="key" [monospace]="true" [text]="oauthClient.clientId" [clipboardSnackbarMessagesConfig]="clientIdClipboardSnackbarMessagesConfig"></dbx-click-to-copy-field>
        @if (oauthClient.clientSecret; as clientSecret) {
          <div class="dbx-mcp-connect-view-label dbx-text-label-medium">Client secret</div>
          <dbx-click-to-copy-field icon="lock" [monospace]="true" [secret]="true" [(revealed)]="showSecretSignal" [text]="clientSecret" [clipboardSnackbarMessagesConfig]="clientSecretClipboardSnackbarMessagesConfig"></dbx-click-to-copy-field>
        } @else if (oauthClientConfidentialSignal()) {
          <div class="dbx-mcp-connect-view-label dbx-text-label-medium">Client secret</div>
          <div class="dbx-mcp-connect-view-note dbx-hint">Use the client secret you saved for this client. It is not shown here.</div>
        }
      }
    } @else {
      <div class="dbx-mcp-connect-view-note dbx-hint">No MCP server is configured for this app.</div>
    }
    @if (serverSignal() && selectedClientSignal(); as client) {
      <div class="dbx-mcp-connect-view-label dbx-mcp-connect-view-clients-label dbx-text-label-medium">Choose your assistant</div>
      <div class="dbx-mcp-connect-view-clients">
        <mat-button-toggle-group [value]="client.id" (change)="onClientChange($event)" aria-label="AI assistant" hideSingleSelectionIndicator>
          @for (option of clientsSignal(); track option.id) {
            <mat-button-toggle [value]="option.id">
              @if (option.icon) {
                <mat-icon aria-hidden="true">{{ option.icon }}</mat-icon>
              }
              {{ option.label }}
            </mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>
      @if (instructionsSignal(); as instructions) {
        <div class="dbx-mcp-connect-view-instructions">
          @for (step of instructions.steps ?? []; track $index) {
            <dbx-step-block [step]="$index + 1" [header]="step"></dbx-step-block>
          }
          @if (instructions.snippet; as snippet) {
            <div class="dbx-mcp-connect-view-label dbx-text-label-medium">{{ snippet.label }}</div>
            <dbx-click-to-copy-text class="dbx-mcp-connect-view-snippet" [copyText]="snippet.text" [clipboardSnackbarMessagesConfig]="snippetClipboardSnackbarMessagesConfig">
              <pre>{{ snippetDisplayTextSignal() }}</pre>
            </dbx-click-to-copy-text>
          }
          @if (instructions.injection; as injection) {
            <dbx-injection class="dbx-mcp-connect-view-injection" [config]="injection"></dbx-injection>
          }
          @if (actionAnchorSignal() || client.docsUrl) {
            <div class="dbx-mcp-connect-view-actions">
              @if (actionAnchorSignal(); as actionAnchor) {
                <dbx-anchor [anchor]="actionAnchor">
                  <dbx-button flat color="primary" [text]="instructions.action?.text" [icon]="instructions.action?.icon"></dbx-button>
                </dbx-anchor>
              }
              @if (client.docsUrl) {
                <a class="dbx-mcp-connect-view-docs-link dbx-text-label-large" [href]="client.docsUrl" target="_blank" rel="noopener">
                  {{ client.label }} docs
                  <mat-icon aria-hidden="true">open_in_new</mat-icon>
                </a>
              }
            </div>
          }
        </div>
      }
    }
  `,
  host: {
    class: 'd-block dbx-mcp-connect-view'
  },
  imports: [MatButtonToggleGroup, MatButtonToggle, MatIconModule, DbxClickToCopyTextComponent, DbxClickToCopyFieldComponent, DbxStepBlockComponent, DbxInjectionComponent, DbxAnchorComponent, DbxButtonComponent]
})
export class DbxMcpConnectViewComponent {
  private readonly _defaultServer = inject(DBX_MCP_CONNECT_SERVER, { optional: true });
  private readonly _mcpConnectService = inject(DbxMcpConnectService, { optional: true });

  readonly config = input<Maybe<DbxMcpConnectViewConfig>>();

  readonly server = input<Maybe<DbxMcpConnectServer>>();
  readonly oauthClient = input<Maybe<DbxMcpConnectOAuthClient>>();
  readonly clients = input<Maybe<DbxMcpConnectClient[]>>();
  readonly defaultClientId = input<Maybe<DbxMcpConnectClientId>>();
  readonly hint = input<Maybe<string>>();

  readonly urlClipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied the MCP server URL.'
  };

  readonly clientIdClipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied the client ID.'
  };

  readonly clientSecretClipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied the client secret.'
  };

  readonly snippetClipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied to clipboard.'
  };

  readonly serverSignal = computed(() => {
    const config = this.config();
    return this.server() ?? config?.server ?? this._defaultServer;
  });

  readonly oauthClientSignal = computed(() => {
    const server = this.serverSignal();
    const config = this.config();
    return this.oauthClient() ?? config?.oauthClient ?? server?.oauthClient;
  });

  /**
   * Whether the OAuth client signs in with a client secret, including one that is not known here.
   */
  readonly oauthClientConfidentialSignal = computed(() => {
    const oauthClient = this.oauthClientSignal();
    return oauthClient ? isConfidentialDbxMcpConnectOAuthClient(oauthClient) : false;
  });

  readonly clientsSignal = computed(() => {
    const config = this.config();
    return this.clients() ?? config?.clients ?? this._mcpConnectService?.clientsSignal() ?? DEFAULT_DBX_MCP_CONNECT_CLIENTS;
  });

  readonly hintSignal = computed(() => {
    const config = this.config();
    return this.hint() ?? config?.hint ?? DEFAULT_DBX_MCP_CONNECT_VIEW_HINT;
  });

  /**
   * Whether the client secret is shown, both in its field and inside snippets. Hidden at first, and toggled by the secret field.
   */
  readonly showSecretSignal = signal(false);

  /**
   * Id of the selected client. Starts from the `defaultClientId` input, the config, or the app's {@link DbxMcpConnectService}, then follows the
   * toggle.
   */
  readonly selectedClientIdSignal = linkedSignal<Maybe<DbxMcpConnectClientId>>(() => this.defaultClientId() ?? this.config()?.defaultClientId ?? this._mcpConnectService?.defaultClientIdSignal());

  readonly selectedClientSignal = computed(() => {
    const clients = this.clientsSignal();
    const selectedClientId = this.selectedClientIdSignal();
    return clients.find((x) => x.id === selectedClientId) ?? clients[0];
  });

  readonly instructionsSignal = computed(() => {
    const oauthClient = this.oauthClientSignal();
    const server = this.serverSignal();
    const client = this.selectedClientSignal();
    return server && client ? client.instructions({ server, oauthClient: oauthClient }) : undefined;
  });

  /**
   * The snippet as displayed, with the client secret hidden until the user reveals it. Copying the snippet always copies the real text.
   */
  readonly snippetDisplayTextSignal = computed(() => {
    const showSecret = this.showSecretSignal();
    const text = this.instructionsSignal()?.snippet?.text;
    const clientSecret = this.oauthClientSignal()?.clientSecret;
    return text && clientSecret && !showSecret ? text.replaceAll(clientSecret, DEFAULT_DBX_CLICK_TO_COPY_FIELD_HIDDEN_TEXT) : text;
  });

  readonly actionAnchorSignal = computed<Maybe<ClickableUrl>>(() => {
    const action = this.instructionsSignal()?.action;
    return action ? clickableUrlInNewTab(action.url) : undefined;
  });

  onClientChange(event: MatButtonToggleChange): void {
    this.selectedClientIdSignal.set(event.value as DbxMcpConnectClientId);
  }
}
