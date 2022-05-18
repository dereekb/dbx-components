
(global as any).testFolderRootPath = '<rootDir>/../../..';

module.exports = {
  displayName: 'firebase-server-test',
  preset: '../../../jest.preset.ts',
  setupFilesAfterEnv: ['<rootDir>/../test-setup.ts'],
  maxWorkers: 2,
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/packages/firebase-server/test',
};
