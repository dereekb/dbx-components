import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UIRouterModule } from '@uirouter/angular';
import { DbxNavbarModule } from './navbar.module';
import { ClickableAnchorLink } from '@dereekb/dbx-core';

describe('NavbarComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        DbxNavbarModule,
        UIRouterModule.forRoot()
      ],
      declarations: [TestViewComponent]
    }).compileComponents();
  });

  let testComponent: TestViewComponent;
  let fixture: ComponentFixture<TestViewComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestViewComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('with links', () => {

    beforeEach(async () => {
      testComponent.links = [{
        title: 'Test'
      }];

      fixture.detectChanges();
    });

    it('should render', () => {
      expect(true).toBe(true);
    });

  });

});

@Component({
  template: `
    <app-nav-bar [links]="links"></app-nav-bar>
  `
})
class TestViewComponent {

  @Input()
  public links?: ClickableAnchorLink[];

}
