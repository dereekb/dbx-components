import { DbxPopoverService } from '@dereekb/dbx-web';
import { DbxActionPopoverFunction, DbxActionSnackbarGeneratorUndoInput } from '@dereekb/dbx-web';
import { ChangeDetectorRef, Component } from '@angular/core';
import { DbxActionContextMachine, DbxActionContextSourceReference, HandleActionFunction, WorkHandlerContext, safeDetectChanges } from '@dereekb/dbx-core';
import { of, delay, BehaviorSubject, tap } from 'rxjs';
import { DocActionExamplePopoverComponent } from '../component/action.example.popover.form.component';

@Component({
  templateUrl: './interaction.component.html'
})
export class DocActionInteractionComponent {

  successValue: any;
  undoValue: any;

  private _value = new BehaviorSubject<{ test: number }>({ test: 0 });
  readonly value$ = this._value.asObservable();

  constructor(readonly dbxPopoverService: DbxPopoverService, readonly cdRef: ChangeDetectorRef) { }

  readonly handleAction: HandleActionFunction = (value: any, context: WorkHandlerContext) => {
    return of(true).pipe(delay(1000));
  }

  onActionSuccess = (value: any) => {
    this.successValue = value;
  };

  resetValue() {
    this._value.next({ test: this._value.value.test + 1 });
  }

  getUndoAction: DbxActionSnackbarGeneratorUndoInput = () => {
    const instance: DbxActionContextSourceReference = new DbxActionContextMachine({
      oneTimeUse: true,
      handleValueReady: (value: any) => {
        safeDetectChanges(this.cdRef);
        return of(0).pipe(delay(1000), tap(() => {
          this.undoValue = value;
        }));
      }
    });

    return instance;
  }

  handleOpenPopover: DbxActionPopoverFunction = ({ origin }) => {
    return DocActionExamplePopoverComponent.openPopover(this.dbxPopoverService, { origin });
  }

}
