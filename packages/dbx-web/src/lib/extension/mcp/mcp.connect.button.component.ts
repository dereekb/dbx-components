import { Component, computed, inject, input } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type DbxButtonDisplay } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '../../button/button.component';
import { type DbxButtonStyle } from '../../button/button';
import { DbxMcpConnectDialogComponent, type DbxMcpConnectDialogConfig } from './mcp.connect.dialog.component';

/**
 * Button display used by {@link DbxMcpConnectButtonComponent} when no display is configured.
 */
export const DEFAULT_DBX_MCP_CONNECT_BUTTON_DISPLAY: DbxButtonDisplay = { icon: 'smart_toy', text: 'Connect AI assistant' };

/**
 * Config for {@link DbxMcpConnectButtonComponent}, combining the dialog config with button display and style options.
 */
export interface DbxMcpConnectButtonConfig extends DbxMcpConnectDialogConfig {
  /**
   * The display configuration for the button. Defaults to {@link DEFAULT_DBX_MCP_CONNECT_BUTTON_DISPLAY}.
   */
  readonly buttonDisplay?: Maybe<DbxButtonDisplay>;
  /**
   * The style configuration for the button.
   */
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
}

/**
 * Drop-in button that opens a dialog with the app's MCP server url and how to connect AI assistants to it.
 *
 * Needs no config in apps that call `provideDbxFirebaseOidc()`, which provides the server url. Otherwise, provide
 * `DBX_MCP_CONNECT_SERVER` or pass a server in the config.
 *
 * @dbxWebComponent
 * @dbxWebSlug mcp-connect-button
 * @dbxWebCategory button
 * @dbxWebRelated mcp-connect-view
 * @dbxWebMinimalExample ```html
 * <dbx-mcp-connect-button></dbx-mcp-connect-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-mcp-connect-button [config]="{ server: { url: 'https://api.example.com/mcp' }, buttonStyle: { type: 'raised', color: 'primary' } }"></dbx-mcp-connect-button>
 * ```
 */
@Component({
  selector: 'dbx-mcp-connect-button',
  template: `
    <dbx-button (buttonClick)="openDialog()" [buttonStyle]="buttonStyleSignal()" [buttonDisplay]="buttonDisplaySignal()"></dbx-button>
  `,
  imports: [DbxButtonComponent]
})
export class DbxMcpConnectButtonComponent {
  private readonly _matDialog = inject(MatDialog);

  readonly config = input<Maybe<DbxMcpConnectButtonConfig>>();

  readonly buttonDisplaySignal = computed(() => this.config()?.buttonDisplay ?? DEFAULT_DBX_MCP_CONNECT_BUTTON_DISPLAY);
  readonly buttonStyleSignal = computed(() => this.config()?.buttonStyle);

  openDialog(): MatDialogRef<DbxMcpConnectDialogComponent> {
    return DbxMcpConnectDialogComponent.openDialog(this._matDialog, this.config());
  }
}
