import baseAngularLibraryConfig from '../../eslint.config.angular.mjs';

/**
 * This configuration is for the app and checks for the demo prefix in the angular selectors
 */
export default [
  ...baseAngularLibraryConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'demo',
          style: 'camelCase'
        }
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'demo',
          style: 'kebab-case'
        }
      ]
    }
  }
];
