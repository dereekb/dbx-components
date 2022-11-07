/* eslint-disable */
(global as any).testFolderRootPath = '<rootDir>/../../..';
(global as any).appTestType = 'node';

module.exports = {
  displayName: 'util-fetch',
  preset: '../../../jest.preset.ts',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json'
    }
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/packages/util/fetch'
};
