import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { type DbxButtonEcho, cleanSubscription } from '@dereekb/dbx-core';
import { type DbxProgressButtonConfig, DbxContentContainerDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent, DbxContentPitDirective, DbxAnchorComponent } from '@dereekb/dbx-web';
import { type Milliseconds } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatIcon } from '@angular/material/icon';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { MatButtonModule } from '@angular/material/button';
import { DEMO_WORKING_INCREASE_OBSERVABLE } from '../../shared/progress';

const DEMO_SPINNER_TIME: Milliseconds = 3350;

@Component({
  templateUrl: './button.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, MatButtonModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxButtonComponent, DbxButtonSpacerDirective, MatIcon, DocFeatureDerivedComponent, DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent, DbxContentPitDirective, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionButtonComponent {
  private readonly _workingIncreaseSub = cleanSubscription();

  readonly workingPercentSignal = signal(0);

  testClicked = '';

  onTestClick() {
    this.testClicked = `Clicked! ${Date.now()}`;
  }

  activateAndDeactivate(key: keyof this) {
    return () => {
      this[key] = { ...this[key], working: true };
      setTimeout(() => {
        this[key] = { ...this[key], working: false };
      }, DEMO_SPINNER_TIME);
    };
  }

  demoButton1: DbxProgressButtonConfig = {
    id: 'button1',
    text: 'Stroked Button',
    buttonColor: 'accent',
    barColor: 'accent',
    buttonType: 'stroked',
    mode: 'indeterminate',
    working: 0,
    disabled: false,
    customClass: 'some-other-class',
    buttonIcon: {
      fontIcon: 'favorite'
    }
  };

  demoButton2: DbxProgressButtonConfig = {
    id: 'button2',
    text: 'Raised Button',
    buttonColor: 'primary',
    barColor: 'primary',
    buttonType: 'raised',
    mode: 'indeterminate',
    working: 0,
    disabled: false
  };

  spinnerButtonConfig: DbxProgressButtonConfig = {
    working: false,
    text: 'Stroked Button',
    spinnerSize: 19,
    buttonType: 'stroked',
    buttonColor: 'accent',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    customClass: 'some-class',
    buttonIcon: {
      fontIcon: 'favorite'
    }
  };

  spinnerButtonConfig1: DbxProgressButtonConfig = {
    working: false,
    text: 'Raised Button',
    spinnerSize: 19,
    buttonType: 'raised',
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate'
  };

  spinnerButtonConfig2: DbxProgressButtonConfig = {
    working: false,
    text: 'Default Button',
    spinnerSize: 19,
    buttonColor: 'primary',
    spinnerColor: 'primary',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate'
  };

  spinnerButtonConfig3: DbxProgressButtonConfig = {
    working: false,
    text: 'Flat Button',
    spinnerSize: 19,
    buttonType: 'flat',
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate'
  };

  spinnerButtonConfig8: DbxProgressButtonConfig = {
    working: false,
    spinnerSize: 19,
    buttonType: 'flat',
    text: 'HELLO WORLD',
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    buttonIcon: {
      fontIcon: 'settings'
    },
    mode: 'indeterminate'
  };

  spinnerButtonConfig4: DbxProgressButtonConfig = {
    working: false,
    spinnerSize: 25, // ignored
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    buttonIcon: {
      fontIcon: 'settings'
    }
  };

  spinnerButtonConfig5: DbxProgressButtonConfig = {
    ...this.spinnerButtonConfig3,
    text: '',
    spinnerSize: undefined
  };

  spinnerButtonConfig6: DbxProgressButtonConfig = {
    working: false,
    text: 'Icon', // ignored
    spinnerSize: 25, // ignored
    iconOnly: true,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    fullWidth: false,
    disabled: false,
    mode: 'indeterminate',
    buttonIcon: {
      fontIcon: 'settings'
    }
  };

  spinnerButtonConfig6Fab: DbxProgressButtonConfig = {
    ...this.spinnerButtonConfig6,
    fab: true
  };

  barButtonConfig: DbxProgressButtonConfig = {
    text: 'Stroked Button'
  };

  barButtonConfigWorkingState = false;

  barButtonConfig1: DbxProgressButtonConfig = {
    ...this.demoButton2,
    text: 'Raised Button'
  };

  barButtonConfig2: DbxProgressButtonConfig = {
    working: false,
    text: 'Default Button',
    buttonColor: 'primary',
    barColor: 'primary',
    mode: 'indeterminate',
    disabled: false
  };

  barButtonConfig3: DbxProgressButtonConfig = {
    working: false,
    text: 'Flat Button',
    buttonColor: 'primary',
    barColor: 'primary',
    buttonType: 'flat',
    mode: 'indeterminate',
    disabled: false
  };

  barButtonConfig4: DbxProgressButtonConfig = {
    working: false,
    text: 'Flat Button',
    buttonColor: 'ok',
    barColor: 'ok',
    buttonType: 'flat',
    mode: 'indeterminate',
    disabled: false
  };

  barButtonConfig5: DbxProgressButtonConfig = {
    working: false,
    text: 'Flat Button',
    buttonColor: 'warn',
    barColor: 'warn',
    buttonType: 'flat',
    mode: 'indeterminate',
    disabled: false
  };

  barButtonConfig6: DbxProgressButtonConfig = {
    working: false,
    text: 'Stroked Button',
    buttonColor: 'success',
    barColor: 'success',
    buttonType: 'stroked',
    mode: 'indeterminate',
    disabled: false
  };

  barButtonConfig7: DbxProgressButtonConfig = {
    working: false,
    text: 'Tonal Button',
    buttonColor: 'ok',
    barColor: 'notice',
    buttonType: 'tonal',
    mode: 'indeterminate',
    disabled: false
  };

  clickSpin1 = this.activateAndDeactivate('spinnerButtonConfig');
  clickSpin2 = this.activateAndDeactivate('spinnerButtonConfig1');
  clickSpin3 = this.activateAndDeactivate('spinnerButtonConfig2');
  clickSpin4 = this.activateAndDeactivate('spinnerButtonConfig3');
  clickSpin5 = this.activateAndDeactivate('spinnerButtonConfig4');
  clickSpin6 = this.activateAndDeactivate('spinnerButtonConfig5');
  clickSpin7 = this.activateAndDeactivate('spinnerButtonConfig6');
  clickSpin8 = this.activateAndDeactivate('spinnerButtonConfig6Fab');

  clickBar1 = () => {
    this.barButtonConfigWorkingState = true;
    setTimeout(() => {
      this.barButtonConfigWorkingState = false;
    }, DEMO_SPINNER_TIME);
  };

  clickBar2 = this.activateAndDeactivate('barButtonConfig1');
  clickBar3 = this.activateAndDeactivate('barButtonConfig2');
  clickBar4 = this.activateAndDeactivate('barButtonConfig3');
  clickBar5 = this.activateAndDeactivate('barButtonConfig4');
  clickBar6 = this.activateAndDeactivate('barButtonConfig5');
  clickBar7 = this.activateAndDeactivate('barButtonConfig6');
  clickBar8 = this.activateAndDeactivate('barButtonConfig7');

  // MARK: Echo Demos
  readonly successEcho: DbxButtonEcho = { icon: 'check', color: 'success', iconOnly: true, duration: 2000 };
  readonly errorEcho: DbxButtonEcho = { icon: 'error', color: 'warn', iconOnly: true, duration: 2000 };
  readonly customEcho: DbxButtonEcho = { icon: 'star', text: 'Nice!', color: 'ok', duration: 3000 };
  readonly iconOnlyEcho: DbxButtonEcho = { icon: 'thumb_up', color: 'success', iconOnly: true, duration: 2000 };

  constructor() {
    this._workingIncreaseSub.subscription = DEMO_WORKING_INCREASE_OBSERVABLE.subscribe((x) => this.workingPercentSignal.set(x));
  }
}
