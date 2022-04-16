import { Component, Directive, Input, OnInit } from "@angular/core";
import { HandleActionFunction, WorkHandlerContext } from "@dereekb/dbx-core";
import { Maybe } from "@dereekb/util";
import { from } from "rxjs";
import { DbxFirebaseAuthService } from "../service/firebase.auth.service";
import { FirebaseLoginMethodType } from "./login";
import { DbxFirebaseAuthLoginService } from "./login.service";

export interface DbxFirebaseLoginButtonConfig {
  text: string;
  iconUrl?: string;
  icon?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  handleLogin: () => Promise<void>;
}

/**
 * Login button and action.
 */
@Component({
  selector: 'dbx-firebase-login-button',
  template: `
  <ng-container dbxAction [dbxActionHandler]="handleAction" dbxActionValue
    [dbxActionSuccess]="onActionSuccess">
    <dbx-button dbxActionButton [customTextColor]="buttonTextColor" [customButtonColor]="buttonColor" [raised]="true">
      <div class="dbx-firebase-login-button-content">
        <span class="dbx-firebase-login-button-icon dbx-icon-spacer">
          <img *ngIf="iconUrl" [src]="iconUrl"/>
          <mat-icon *ngIf="icon">{{icon}}</mat-icon>
        </span>
        <span class="dbx-firebase-login-button-text">{{ text }}</span>
      </div>
    </dbx-button>
  </ng-container>
  `,
  host: {
    'class': 'dbx-firebase-login-button'
  }
})
export class DbxFirebaseLoginButtonComponent {

  @Input()
  config: Maybe<DbxFirebaseLoginButtonConfig>;

  get iconUrl() {
    return this.config?.iconUrl;
  }

  get icon() {
    return this.config?.icon;
  }

  get text() {
    return this.config?.text;
  }

  get buttonColor() {
    return this.config?.buttonColor ?? 'transparent';
  }

  get buttonTextColor() {
    return this.config?.buttonTextColor;
  }

  readonly handleAction: HandleActionFunction = (value: any, context: WorkHandlerContext) => {
    const loginPromise: Promise<void> = this.config!.handleLogin();
    return from(loginPromise);
  }

  onActionSuccess = (value: any) => {
    // todo: show checkmark on success?
  };

}

@Component({
  selector: 'dbx-firebase-login-button-container',
  template: `
  <div class="dbx-firebase-login-button-container">
    <ng-content></ng-content>
  </div>
  `
})
export class DbxFirebaseLoginButtonContainerComponent { }

export const DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE = `
  <dbx-firebase-login-button-container>
    <dbx-firebase-login-button [config]="config"></dbx-firebase-login-button>
  </dbx-firebase-login-button-container>
`;

@Directive()
export abstract class AbstractConfiguredDbxFirebaseLoginButtonDirective implements OnInit {

  private _config!: DbxFirebaseLoginButtonConfig;

  abstract readonly loginProvider: FirebaseLoginMethodType;

  constructor(readonly dbxFirebaseAuthService: DbxFirebaseAuthService, readonly dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) { }

  ngOnInit(): void {
    const assets = this.dbxFirebaseAuthLoginService.getProviderAssets(this.loginProvider) ?? {};

    this._config = {
      text: assets.loginText ?? `<loginText not configured>`,
      icon: assets.loginIcon,
      iconUrl: assets.logoUrl,
      buttonColor: assets.backgroundColor,
      buttonTextColor: assets.textColor,
      handleLogin: () => this.handleLogin()
    };
  }

  abstract handleLogin(): Promise<any>;

  get config() {
    return this._config;
  }

}
