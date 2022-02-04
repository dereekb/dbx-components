import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UIRouterModule } from '@uirouter/angular';
import { DbxNavbarModule } from './navbar.module';
import { ClickableAnchorLink, DbxCoreUIRouterSegueModule } from '@dereekb/dbx-core';
import { APP_BASE_HREF } from '@angular/common';
import { DbxWebUIRouterModule } from '../../provider/uirouter/uirouter.router.module';
import { BrowserModule } from '@angular/platform-browser';
import { DbxScreenModule } from '../../../screen';

describe('NavbarComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        NoopAnimationsModule,
        DbxNavbarModule,
        DbxScreenModule.forRoot(),
        DbxCoreUIRouterSegueModule.forRoot(),
        DbxWebUIRouterModule.forRoot(),
        UIRouterModule.forRoot()
      ],
      declarations: [TestViewComponent],
      providers: [{ provide: APP_BASE_HREF, useValue: '/' }]
    }).compileComponents();
  });

  let testComponent: TestViewComponent;
  let fixture: ComponentFixture<TestViewComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestViewComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('with anchors', () => {

    beforeEach(async () => {
      testComponent.anchors = [{
        title: 'Test'
      }];

      fixture.detectChanges();
    });

    it('should render', () => {
      
      // TODO

      expect(true).toBe(true);
    });

  });

});

@Component({
  template: `
    <dbx-navbar [anchors]="anchors"></dbx-navbar>
  `
})
class TestViewComponent {

  @Input()
  public anchors?: ClickableAnchorLink[];

}
