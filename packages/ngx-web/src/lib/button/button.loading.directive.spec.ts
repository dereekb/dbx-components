import { NgxDefaultWebModule } from './../ngx-web.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DbNgxButtonComponent } from './button.component';
import { DbNgxButtonModule } from './button.module';
import { filter } from 'rxjs/operators';
import { DbNgxCoreActionModule, DbNgxLoadingButtonDirective } from '@dereekb/ngx-core';
import { SimpleLoadingContext } from '@dereekb/util-rxjs';

describe('DbNgxLoadingButton', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        NgxDefaultWebModule,
        DbNgxCoreActionModule,
        DbNgxButtonModule
      ],
      declarations: [
        TestDbNgxLoadingButtonDirectiveComponent,
      ]
    }).compileComponents();
  });

  let testComponent: TestDbNgxLoadingButtonDirectiveComponent;
  let fixture: ComponentFixture<TestDbNgxLoadingButtonDirectiveComponent>;
  let button: DbNgxButtonComponent;

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
      <dbx-button [dbxLoadingButton]="context"></dbx-button>
    </div>
  `
})
class TestDbNgxLoadingButtonDirectiveComponent {

  context = new SimpleLoadingContext(false);

  @ViewChild(DbNgxLoadingButtonDirective, { static: true })
  loadingButtonDirective?: DbNgxLoadingButtonDirective;

  @ViewChild(DbNgxButtonComponent, { static: true })
  button?: DbNgxButtonComponent;

}
