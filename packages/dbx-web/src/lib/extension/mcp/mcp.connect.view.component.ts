import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { MatButtonToggle, type MatButtonToggleChange, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { type ClickableUrl, clickableUrlInNewTab } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '../../button/button.component';
import { type CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig } from '../../util/clipboard';
import { DbxContentPitDirective } from '../../layout/content/content.pit.directive';
import { DbxClickToCopyTextComponent } from '../../layout/text/copy.text.component';
import { DbxDetailBlockComponent } from '../../layout/text/detail.block.component';
import { DbxStepBlockComponent } from '../../layout/text/step.block.component';
import { DbxAnchorComponent } from '../../router/layout/anchor/anchor.component';
import { DBX_MCP_CONNECT_SERVER, DEFAULT_DBX_MCP_CONNECT_CLIENTS, type DbxMcpConnectClient, type DbxMcpConnectClientId, type DbxMcpConnectServer } from './mcp.connect';

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
   * Clients to show instructions for, in display order. Defaults to {@link DEFAULT_DBX_MCP_CONNECT_CLIENTS}.
   */
  readonly clients?: Maybe<DbxMcpConnectClient[]>;
  /**
   * Id of the client selected at first. Defaults to the first client.
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
 * <dbx-mcp-connect-view [server]="{ url: 'https://api.example.com/mcp', label: 'Example' }" [clients]="clients"></dbx-mcp-connect-view>
 * ```
 */
@Component({
  selector: 'dbx-mcp-connect-view',
  template: `
    @if (hintSignal()) {
      <p class="dbx-note">{{ hintSignal() }}</p>
    }
    <dbx-content-pit class="dbx-block dbx-mb3">
      <dbx-detail-block icon="link" header="MCP server URL">
        @if (serverSignal(); as server) {
          <dbx-click-to-copy-text [copyText]="server.url" [clipboardSnackbarMessagesConfig]="urlClipboardSnackbarMessagesConfig">
            <div class="dbx-label dbx-mcp-connect-view-url">{{ server.url }}</div>
          </dbx-click-to-copy-text>
        } @else {
          <div class="dbx-hint">No MCP server is configured for this app.</div>
        }
      </dbx-detail-block>
    </dbx-content-pit>
    @if (serverSignal() && selectedClientSignal(); as client) {
      <div class="dbx-mcp-connect-view-clients dbx-mb3">
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
        @for (step of instructions.steps; track $index) {
          <dbx-step-block class="dbx-mb3" [step]="$index + 1" [header]="step"></dbx-step-block>
        }
        @if (instructions.snippet; as snippet) {
          <div class="dbx-label dbx-mb2">{{ snippet.label }}</div>
          <dbx-content-pit class="dbx-block dbx-mb3">
            <dbx-click-to-copy-text [copyText]="snippet.text" [clipboardSnackbarMessagesConfig]="snippetClipboardSnackbarMessagesConfig">
              <pre class="dbx-mcp-connect-view-snippet">{{ snippet.text }}</pre>
            </dbx-click-to-copy-text>
          </dbx-content-pit>
        }
        @if (actionAnchorSignal(); as actionAnchor) {
          <div class="dbx-mb3">
            <dbx-anchor [anchor]="actionAnchor">
              <dbx-button raised color="primary" [text]="instructions.action?.text" [icon]="instructions.action?.icon"></dbx-button>
            </dbx-anchor>
          </div>
        }
      }
      @if (client.docsUrl) {
        <a class="dbx-hint" [href]="client.docsUrl" target="_blank" rel="noopener">{{ client.label }} documentation</a>
      }
    }
  `,
  host: {
    class: 'd-block dbx-mcp-connect-view'
  },
  imports: [MatButtonToggleGroup, MatButtonToggle, MatIconModule, DbxContentPitDirective, DbxDetailBlockComponent, DbxClickToCopyTextComponent, DbxStepBlockComponent, DbxAnchorComponent, DbxButtonComponent]
})
export class DbxMcpConnectViewComponent {
  private readonly _defaultServer = inject(DBX_MCP_CONNECT_SERVER, { optional: true });

  readonly config = input<Maybe<DbxMcpConnectViewConfig>>();

  readonly server = input<Maybe<DbxMcpConnectServer>>();
  readonly clients = input<Maybe<DbxMcpConnectClient[]>>();
  readonly defaultClientId = input<Maybe<DbxMcpConnectClientId>>();
  readonly hint = input<Maybe<string>>();

  readonly urlClipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied the MCP server URL.'
  };

  readonly snippetClipboardSnackbarMessagesConfig: CopyToClipboardFunctionWithSnackbarMessageSnackbarConfig = {
    successMessage: 'Copied to clipboard.'
  };

  readonly serverSignal = computed(() => {
    const config = this.config();
    return this.server() ?? config?.server ?? this._defaultServer;
  });

  readonly clientsSignal = computed(() => {
    const config = this.config();
    return this.clients() ?? config?.clients ?? DEFAULT_DBX_MCP_CONNECT_CLIENTS;
  });

  readonly hintSignal = computed(() => {
    const config = this.config();
    return this.hint() ?? config?.hint ?? DEFAULT_DBX_MCP_CONNECT_VIEW_HINT;
  });

  /**
   * Id of the selected client. Starts from the `defaultClientId` input, then follows the toggle.
   */
  readonly selectedClientIdSignal = linkedSignal<Maybe<DbxMcpConnectClientId>>(() => this.defaultClientId() ?? this.config()?.defaultClientId);

  readonly selectedClientSignal = computed(() => {
    const clients = this.clientsSignal();
    const selectedClientId = this.selectedClientIdSignal();
    return clients.find((x) => x.id === selectedClientId) ?? clients[0];
  });

  readonly instructionsSignal = computed(() => {
    const server = this.serverSignal();
    const client = this.selectedClientSignal();
    return server && client ? client.instructions(server) : undefined;
  });

  readonly actionAnchorSignal = computed<Maybe<ClickableUrl>>(() => {
    const action = this.instructionsSignal()?.action;
    return action ? clickableUrlInNewTab(action.url) : undefined;
  });

  onClientChange(event: MatButtonToggleChange): void {
    this.selectedClientIdSignal.set(event.value as DbxMcpConnectClientId);
  }
}
