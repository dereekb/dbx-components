import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxSidenavComponent, DbxSidenavButtonComponent, DbxPagebarComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  templateUrl: './sidenav.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxSidenavComponent, DbxSidenavButtonComponent, DbxPagebarComponent, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .dbx-sidenav-demo-container {
        height: 300px;
        border: 1px solid rgba(128, 128, 128, 0.3);
        border-radius: 4px;
        overflow: hidden;
        position: relative;
      }

      .dbx-sidenav-demo-header {
        padding: 12px 16px;
        margin: 0;
      }

      .dbx-sidenav-demo-page {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .dbx-sidenav-demo-page-content {
        flex: 1;
        overflow: auto;
      }

      .dbx-sidenav-demo-user-button {
        display: flex;
        align-items: center;
        gap: 10px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 24px;
        color: inherit;
      }

      .dbx-sidenav-demo-user-button:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .dbx-sidenav-demo-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .dbx-sidenav-demo-user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.2;
      }

      .dbx-sidenav-demo-user-name {
        font-size: 13px;
        font-weight: 500;
      }

      .dbx-sidenav-demo-user-role {
        font-size: 11px;
        opacity: 0.7;
      }

      .dbx-sidenav-demo-drawer-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .dbx-sidenav-demo-drawer-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
      }

      .dbx-sidenav-demo-drawer-user-info {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }

      .dbx-sidenav-demo-drawer-user-name {
        font-size: 14px;
        font-weight: 500;
      }

      .dbx-sidenav-demo-drawer-user-email {
        font-size: 12px;
        opacity: 0.7;
      }
    `
  ]
})
export class DocRouterSidenavComponent {
  readonly exampleAnchors: ClickableAnchorLinkTree[] = [
    {
      icon: 'home',
      title: 'Home',
      ref: 'doc.router.sidenav'
    },
    {
      icon: 'settings',
      title: 'Settings',
      ref: 'doc.router.sidenav'
    },
    {
      icon: 'person',
      title: 'Profile',
      ref: 'doc.router.sidenav'
    }
  ];
}
