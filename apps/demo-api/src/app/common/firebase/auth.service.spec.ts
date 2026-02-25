import { demoApiFunctionContextFactory } from './../../../test/fixture';

demoApiFunctionContextFactory((f) => {
  it('should', () => {
    console.log('hello');
  });
});
