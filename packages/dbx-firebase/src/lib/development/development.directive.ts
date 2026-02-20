import { HostListener, AfterViewInit, Directive, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DbxPopupService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseDevelopmentPopupComponent } from './development.popup.component';
import { DbxFirebaseDevelopmentService } from './development.service';
import { clean } from '@dereekb/dbx-core';

/**
 * Directive for showing the development tools snackbar when the app opens up and listening for keybindings for opening the popup.
 */
@Directive({
  selector: '[dbxFirebaseDevelopment]',
  standalone: true
})
export class DbxFirebaseDevelopmentDirective implements AfterViewInit {
  readonly popupService = inject(DbxPopupService);
  readonly matSnackBar = inject(MatSnackBar);
  readonly dbxFirebaseDevelopmentService = inject(DbxFirebaseDevelopmentService);

  ref?: NgPopoverRef<any, any>;

  get enabled() {
    return this.dbxFirebaseDevelopmentService.enabled;
  }

  constructor() {
    clean(() => this.closePopup());
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.enabled && event.shiftKey && event.altKey && event.code === 'KeyD') {
      this.togglePopup();
      event.preventDefault();
    }
  }

  togglePopup() {
    if (this.ref) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  openPopup() {
    if (!this.ref) {
      const ref = DbxFirebaseDevelopmentPopupComponent.openPopup(this.popupService);
      ref.afterClosed$.subscribe(() => {
        if (this.ref === ref) {
          this.ref = undefined;
        }
      });

      this.ref = ref;
    }
  }

  closePopup() {
    if (this.ref != null) {
      this.ref.close();
    }
  }

  ngAfterViewInit(): void {
    if (this.enabled) {
      this.matSnackBar
        .open('Dev Tools: alt/option + shift + D', 'Open', {
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          duration: 8 * 1000
        })
        .onAction()
        .subscribe(() => {
          this.openPopup();
        });
    }
  }
}
