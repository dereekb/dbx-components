import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbNgxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { DbNgxLoadingProgressComponent } from './loading-progress.component';
import { ValuesLoadingContext } from '@dereekb/rxjs';
import { DbNgxReadableErrorComponent } from '../error';
import { DbNgxBasicLoadingComponent, LoadingComponentState } from './basic-loading.component';
import { filter, first } from 'rxjs';

export function waitForState(state: LoadingComponentState): (component: DbNgxBasicLoadingComponent) => (checkFn: () => void) => void {
  return (component: DbNgxBasicLoadingComponent) => {
    return (checkFn: () => void) => {
      component.state$.pipe(
        filter(x => x === state), first()
      ).subscribe(checkFn);
    };
  };
}

describe('DbNgxLoadingComponent', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DbNgxLoadingModule
      ],
      declarations: [LoadingComponent]
    }).compileComponents();
  });

  describe('with content', () => {
    let fixture: ComponentFixture<LoadingComponent>;
    let component: LoadingComponent;
    let basicLoadingComponent: DbNgxBasicLoadingComponent;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;
    let waitForComponentToHaveContent: (checkFn: () => void) => void;
    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(LoadingComponent);
      component = fixture.componentInstance;
      basicLoadingComponent = fixture.debugElement.query(By.directive(DbNgxBasicLoadingComponent)).componentInstance;

      waitForComponentToBeLoading = waitForState(LoadingComponentState.LOADING)(basicLoadingComponent);
      waitForComponentToHaveContent = waitForState(LoadingComponentState.CONTENT)(basicLoadingComponent);
      waitForComponentToHaveError = waitForState(LoadingComponentState.ERROR)(basicLoadingComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the content if not loading and no error.', (done) => {
      component.context.setLoading(false);
      fixture.detectChanges();

      waitForComponentToHaveContent(() => {
        const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;
        expect(testContent).not.toBeNull();
        expect(testContent.textContent).toBe(TEST_CONTENT);
        done();
      });
    });

    describe('and error', () => {

      beforeEach(async () => {
        component.context.setError({
          code: 'Test',
          message: 'Test'
        });

        fixture.detectChanges();
      });

      it('should display the error.', (done) => {
        waitForComponentToHaveError(() => {
          const errorComponentQueryResult = fixture.debugElement.query(By.directive(DbNgxReadableErrorComponent));
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

    describe('and loading', () => {

      beforeEach(() => {
        component.context.setLoading(true);
        fixture.detectChanges();
      });

      it('should display the loading progress view while loading.', (done) => {
        waitForComponentToBeLoading(() => {
          const loadingProgressQueryResult = fixture.debugElement.query(By.directive(DbNgxLoadingProgressComponent));
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
    <dbx-loading [context]="context" [text]="text" [show]="show">
      <div>
        <p id="test-content">${TEST_CONTENT}</p>
      </div>
    </dbx-loading>
  `
})
class LoadingComponent {

  public show?: boolean;

  public text?: string;

  public context = new ValuesLoadingContext();

}
