(global as any).appTestType = 'angular';

const jestPresetAngularSerializers = require('jest-preset-angular/build/serializers');

module.exports = {
  preset: '../../jest.preset.ts',
  coverageDirectory: '../../coverage/packages/dbx-core',
  displayName: 'dbx-core',
  testEnvironment: 'jsdom',
  snapshotSerializers: jestPresetAngularSerializers
};
