import { Component, computed } from '@angular/core';
import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type Maybe } from '@dereekb/util';
import { AbstractDialogDirective } from '../../interaction/dialog/abstract.dialog.directive';
import { DbxDialogModule } from '../../interaction/dialog/dialog.module';
import { DbxMcpConnectViewComponent, type DbxMcpConnectViewConfig } from './mcp.connect.view.component';

/**
 * Header shown by {@link DbxMcpConnectDialogComponent} when no header is configured.
 */
export const DEFAULT_DBX_MCP_CONNECT_DIALOG_HEADER = 'Connect an AI assistant';

/**
 * Width {@link DbxMcpConnectDialogComponent} opens at. Material narrows it on small screens.
 */
export const DBX_MCP_CONNECT_DIALOG_WIDTH = '600px';

/**
 * Config for {@link DbxMcpConnectDialogComponent}.
 */
export interface DbxMcpConnectDialogConfig extends DbxMcpConnectViewConfig {
  /**
   * Dialog header. Defaults to {@link DEFAULT_DBX_MCP_CONNECT_DIALOG_HEADER}.
   */
  readonly header?: Maybe<string>;
}

/**
 * Dialog that shows a {@link DbxMcpConnectViewComponent}: the app's MCP server url and how to connect AI assistants to it.
 *
 * Usually opened by `dbx-mcp-connect-button`.
 */
@Component({
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <h3>{{ headerSignal() }}</h3>
      <dbx-mcp-connect-view [config]="data"></dbx-mcp-connect-view>
      <dbx-dialog-content-footer (close)="close()"></dbx-dialog-content-footer>
    </dbx-dialog-content>
  `,
  imports: [DbxDialogModule, DbxMcpConnectViewComponent]
})
export class DbxMcpConnectDialogComponent extends AbstractDialogDirective<unknown, Maybe<DbxMcpConnectDialogConfig>> {
  readonly headerSignal = computed(() => this.data?.header ?? DEFAULT_DBX_MCP_CONNECT_DIALOG_HEADER);

  static openDialog(matDialog: MatDialog, config?: Maybe<DbxMcpConnectDialogConfig>): MatDialogRef<DbxMcpConnectDialogComponent> {
    // fixed so the dialog does not resize as the selected client's instructions change
    return matDialog.open(DbxMcpConnectDialogComponent, {
      width: DBX_MCP_CONNECT_DIALOG_WIDTH,
      data: config
    });
  }
}
