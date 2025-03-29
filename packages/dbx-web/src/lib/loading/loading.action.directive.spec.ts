import { DbxActionContextStoreSourceInstance, DbxActionDirective } from '@dereekb/dbx-core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { DbxErrorComponent } from '../error';
import { DbxBasicLoadingComponent, LoadingComponentState } from './basic-loading.component';
import { DbxActionModule } from '../action/action.module';
import { filter, first } from 'rxjs';

export function waitForState(state: LoadingComponentState): (component: DbxBasicLoadingComponent) => (checkFn: () => void) => void {
  return (component: DbxBasicLoadingComponent) => {
    return (checkFn: () => void) => {
      component.state$
        .pipe(
          filter((x) => x === state),
          first()
        )
        .subscribe(checkFn);
    };
  };
}

describe('DbxActionLoadingContextDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DbxLoadingModule, DbxActionModule],
      declarations: [LoadingComponent]
    }).compileComponents();
  });

  describe('with content', () => {
    let fixture: ComponentFixture<LoadingComponent>;
    let component: LoadingComponent;
    let basicLoadingComponent: DbxBasicLoadingComponent;
    let dbxActionDirective: DbxActionDirective;
    let dbxActionContextStoreSourceInstance: DbxActionContextStoreSourceInstance;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;
    let waitForComponentToHaveContent: (checkFn: () => void) => void;
    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(LoadingComponent);
      component = fixture.componentInstance;
      basicLoadingComponent = fixture.debugElement.query(By.directive(DbxBasicLoadingComponent)).componentInstance;
      dbxActionDirective = component.dbxActionDirective!;
      dbxActionContextStoreSourceInstance = dbxActionDirective.sourceInstance;

      waitForComponentToBeLoading = waitForState(LoadingComponentState.LOADING)(basicLoadingComponent);
      waitForComponentToHaveContent = waitForState(LoadingComponentState.CONTENT)(basicLoadingComponent);
      waitForComponentToHaveError = waitForState(LoadingComponentState.ERROR)(basicLoadingComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the content if state is idle.', (done) => {
      dbxActionContextStoreSourceInstance.reset();
      fixture.detectChanges();

      waitForComponentToHaveContent(() => {
        const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;
        expect(testContent).not.toBeNull();
        expect(testContent.textContent).toBe(TEST_CONTENT);
        done();
      });
    });

    describe('and error/rejection', () => {
      beforeEach(async () => {
        dbxActionContextStoreSourceInstance.reject({
          code: 'Test',
          message: 'Test'
        });

        fixture.detectChanges();
      });

      it('should display the error.', (done) => {
        waitForComponentToHaveError(() => {
          const errorComponentQueryResult = fixture.debugElement.query(By.directive(DbxErrorComponent));
          expect(errorComponentQueryResult).not.toBeNull();
          done();
        });
      });

      it('should not display the content.', (done) => {
        waitForComponentToHaveError(() => {
          const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
          expect(testContentQueryResult).toBeNull();
          done();
        });
      });
    });

    describe('and working', () => {
      beforeEach(() => {
        dbxActionContextStoreSourceInstance.startWorking();
        fixture.detectChanges();
      });

      it('should display the loading progress view while loading.', (done) => {
        waitForComponentToBeLoading(() => {
          const loadingProgressQueryResult = fixture.debugElement.query(By.directive(DbxLoadingProgressComponent));
          expect(loadingProgressQueryResult).not.toBeNull();
          done();
        });
      });
    });
  });
});

const TEST_CONTENT = 'Content';

@Component({
  template: `
    <dbx-action>
      <dbx-loading dbxActionLoadingContext [text]="text" [show]="show">
        <div>
          <p id="test-content">${TEST_CONTENT}</p>
        </div>
      </dbx-loading>
    </dbx-action>
  `
})
class LoadingComponent {
  public show?: boolean;

  public text?: string;

  @ViewChild(DbxActionDirective, { static: true })
  dbxActionDirective?: DbxActionDirective;
}
