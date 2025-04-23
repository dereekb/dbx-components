import baseAngularAppConfig from '../../eslint.config.angular.app.mjs';

export default [
  ...baseAngularAppConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: ['demo', 'doc', 'app'],
          style: 'camelCase'
        }
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: ['demo', 'doc', 'app'],
          style: 'kebab-case'
        }
      ]
    }
  }
];
