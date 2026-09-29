module.exports = {
  root: true,
  extends: '@react-native',
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-shadow': ['error'],
        'no-shadow': 'off',
        'no-undef': 'off',
      },
    },
    {
      // Jest infrastructure: setup, config, manual mocks, and test files
      // run under the jest environment.
      files: [
        'jest.setup.js',
        'jest.config.js',
        '__mocks__/**/*.js',
        '**/__tests__/**/*.[jt]s?(x)',
      ],
      env: { jest: true },
    },
  ],
};
