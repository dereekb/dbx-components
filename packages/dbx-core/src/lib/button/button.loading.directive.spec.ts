import { DbNgxCoreButtonModule } from './button.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { filter } from 'rxjs/operators';
import { DbNgxButtonDirective, DbNgxLoadingButtonDirective } from '.';
import { SimpleLoadingContext } from '@dereekb/rxjs';

describe('DbNgxLoadingButton', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        DbNgxCoreButtonModule
      ],
      declarations: [
        TestDbNgxLoadingButtonDirectiveComponent,
      ]
    }).compileComponents();
  });

  let testComponent: TestDbNgxLoadingButtonDirectiveComponent;
  let fixture: ComponentFixture<TestDbNgxLoadingButtonDirectiveComponent>;
  let button: DbNgxButtonDirective;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbNgxLoadingButtonDirectiveComponent);
    testComponent = fixture.componentInstance;
    button = testComponent.button!;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(testComponent.loadingButtonDirective).toBeDefined();
  });

  it('should be linked to the button', () => {
    expect((testComponent.loadingButtonDirective as any)._subscriptionObject.hasSubscription).toBe(true);
  });

  it('should set the button to working when loading is true.', (done) => {
    testComponent.context.setLoading(true);

    testComponent.context.stream$.pipe(filter((x => Boolean(x.loading)))).subscribe((x) => {
      expect(x.loading).toBe(true);
      expect(button.working).toBe(true);
      done();
    });
  });

});

@Component({
  template: `
    <div>
      <button dbxButton [dbxLoadingButton]="context"></button>
    </div>
  `
})
class TestDbNgxLoadingButtonDirectiveComponent {

  context = new SimpleLoadingContext(false);

  @ViewChild(DbNgxLoadingButtonDirective, { static: true })
  loadingButtonDirective?: DbNgxLoadingButtonDirective;

  @ViewChild(DbNgxButtonDirective, { static: true })
  button?: DbNgxButtonDirective;

}
