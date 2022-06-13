(global as any).appTestType = 'firebase';

module.exports = {
  displayName: 'API_APP_NAME',
  maxWorkers: 2,
  coverageDirectory: '../../coverage/apps/API_APP_NAME',
  preset: '../../jest.preset.ts'
};
