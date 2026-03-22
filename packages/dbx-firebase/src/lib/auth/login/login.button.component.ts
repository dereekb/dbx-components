import { Component, Directive, type OnInit, inject, signal, computed, ChangeDetectionStrategy, model } from '@angular/core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { type DbxFirebaseLoginMode, type FirebaseLoginMethodType } from './login';
import { type DbxFirebaseAuthLoginProviderAssets, DbxFirebaseAuthLoginService } from './login.service';
import { DbxFirebaseLoginContext } from './login.context';
import { MatIconModule } from '@angular/material/icon';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { firebaseAuthErrorToReadableError, type FirebaseAuthError } from '@dereekb/firebase';

/**
 * Configuration for a login button's appearance and action handler.
 */
export interface DbxFirebaseLoginButtonConfig {
  text: string;
  iconUrl?: string;
  icon?: string;
  iconFilter?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  handleLogin: () => Promise<unknown>;
}

/**
 * Renders a styled login button that triggers a login action handler on click.
 *
 * Displays a logo image or icon alongside the login text with configurable colors.
 */
@Component({
  selector: 'dbx-firebase-login-button',
  template: `
    <ng-container dbxAction [dbxActionHandler]="handleAction" dbxActionValue [dbxActionSuccessHandler]="onActionSuccess">
      <dbx-button dbxActionButton [customTextColor]="buttonTextColorSignal()" [customButtonColor]="buttonColorSignal()" [raised]="true">
        <div class="dbx-firebase-login-button-content">
          <span class="dbx-firebase-login-button-icon dbx-icon-spacer">
            @if (iconUrlSignal()) {
              <img [src]="iconUrlSignal()" alt="" [style.filter]="iconFilterSignal()" />
            }
            @if (iconSignal()) {
              <mat-icon>{{ iconSignal() }}</mat-icon>
            }
          </span>
          <span class="dbx-firebase-login-button-text">{{ textSignal() }}</span>
        </div>
      </dbx-button>
    </ng-container>
  `,
  host: {
    class: 'dbx-firebase-login-button'
  },
  standalone: true,
  imports: [MatIconModule, DbxActionModule, DbxButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseLoginButtonComponent {
  readonly config = model<Maybe<DbxFirebaseLoginButtonConfig>>(null);

  readonly iconUrlSignal = computed(() => this.config()?.iconUrl);
  readonly iconSignal = computed(() => this.config()?.icon);
  readonly iconFilterSignal = computed(() => this.config()?.iconFilter);
  readonly textSignal = computed(() => this.config()?.text ?? '');
  readonly buttonColorSignal = computed(() => this.config()?.buttonColor ?? 'transparent');
  readonly buttonTextColorSignal = computed(() => this.config()?.buttonTextColor);

  setConfig(config: Maybe<DbxFirebaseLoginButtonConfig>) {
    this.config.set(config);
  }

  readonly handleAction: WorkUsingContext = (_, context) => {
    const config = this.config();

    if (config != null) {
      const loginPromise = config.handleLogin();
      context.startWorkingWithPromise(loginPromise);
    } else {
      context.reject();
    }
  };

  onActionSuccess = () => {
    // todo: show checkmark on success?
  };
}

/**
 * Container component that wraps login button content with consistent spacing.
 */
@Component({
  selector: 'dbx-firebase-login-button-container',
  template: `
    <div class="dbx-firebase-login-button-container">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true
})
export class DbxFirebaseLoginButtonContainerComponent {}

/**
 * Default template for configured login button components.
 */
export const DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE = `
  <dbx-firebase-login-button-container>
    <dbx-firebase-login-button [config]="configSignal()"></dbx-firebase-login-button>
  </dbx-firebase-login-button-container>
`;

/**
 * Shared component configuration for OAuth-style login button components.
 */
export const DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION: Pick<Component, 'template' | 'imports' | 'changeDetection'> = {
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE,
  imports: [DbxFirebaseLoginButtonComponent, DbxFirebaseLoginButtonContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
};

/**
 * Data passed to login button components via {@link DBX_INJECTION_COMPONENT_DATA} from the login list.
 */
export interface DbxFirebaseLoginButtonInjectionData {
  /**
   * The current login mode for this button instance.
   */
  readonly loginMode: DbxFirebaseLoginMode;
}

/**
 * Abstract base directive for login provider buttons that auto-configures appearance
 * from the registered provider assets and delegates login handling to subclasses.
 *
 * Supports login, register, and link modes. In link mode, the button text is derived from
 * the provider's `linkText` or defaults to "Connect " + `providerName`.
 *
 * @example
 * ```typescript
 * export class MyProviderComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
 *   readonly loginProvider = 'myprovider';
 *   handleLogin() { return this.dbxFirebaseAuthService.logInWithPopup(new MyProvider()); }
 *   handleLink() { return this.dbxFirebaseAuthService.linkWithPopup(new MyProvider()); }
 * }
 * ```
 */
@Directive()
export abstract class AbstractConfiguredDbxFirebaseLoginButtonDirective implements OnInit {
  abstract readonly loginProvider: FirebaseLoginMethodType;

  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);
  readonly dbxFirebaseLoginContext = inject(DbxFirebaseLoginContext);

  private readonly _injectionData = inject<DbxFirebaseLoginButtonInjectionData>(DBX_INJECTION_COMPONENT_DATA, { optional: true });

  private readonly _config = signal<DbxFirebaseLoginButtonConfig | null>(null);
  readonly configSignal = computed(() => this._config());

  /**
   * The effective login mode, derived from injection data or defaulting to 'login'.
   *
   * @returns The login mode for this button instance.
   */
  get effectiveLoginMode(): DbxFirebaseLoginMode {
    return this._injectionData?.loginMode ?? 'login';
  }

  ngOnInit(): void {
    const assets = this.assetConfig;
    const text = this._textForMode(assets);

    this._config.set({
      text,
      icon: assets.loginIcon,
      iconUrl: assets.logoUrl,
      iconFilter: assets.logoFilter,
      buttonColor: assets.backgroundColor,
      buttonTextColor: assets.textColor,
      handleLogin: () => this._handleAction()
    });
  }

  abstract handleLogin(): Promise<unknown>;

  /**
   * Handles the link action. Override in subclasses that support linking.
   * Throws by default for providers that do not support linking.
   *
   * @returns A promise that resolves when the link action completes.
   */
  handleLink(): Promise<unknown> {
    throw new Error(`Linking is not supported for the "${this.loginProvider}" provider.`);
  }

  get providerConfig() {
    return this.dbxFirebaseAuthLoginService.getLoginProvider(this.loginProvider);
  }

  get assetConfig() {
    return this.dbxFirebaseAuthLoginService.getProviderAssets(this.loginProvider) ?? {};
  }

  get config() {
    return this._config() as DbxFirebaseLoginButtonConfig;
  }

  private _textForMode(assets: DbxFirebaseAuthLoginProviderAssets): string {
    let text: string;

    if (this.effectiveLoginMode === 'link') {
      text = assets.linkText ?? (assets.providerName ? `Connect ${assets.providerName}` : '<linkText not configured>');
    } else {
      text = assets.loginText ?? '<loginText not configured>';
    }

    return text;
  }

  private _handleAction(): Promise<unknown> {
    let promise: Promise<unknown>;

    if (this.effectiveLoginMode === 'link') {
      promise = this.handleLink();
    } else {
      promise = this.handleLogin();
    }

    return promise.catch((error) => {
      throw firebaseAuthErrorToReadableError(error as FirebaseAuthError);
    });
  }
}
