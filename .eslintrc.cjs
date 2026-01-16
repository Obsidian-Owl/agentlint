/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2024: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
  ],
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // CLI apps need console output
    'no-console': 'off',

    // General best practices
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.cjs'],
  overrides: [
    {
      // Relax some rules for test files
      files: ['tests/**/*.ts', 'tests/**/*.test.ts'],
      rules: {
        // Allow awaiting sync functions in tests (common pattern when APIs change from async to sync)
        '@typescript-eslint/await-thenable': 'off',
        // Allow require() in tests for mocking
        '@typescript-eslint/no-require-imports': 'off',
        // Allow any types in tests for mocking/stubbing
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        // Allow implicit return types in test callbacks
        '@typescript-eslint/explicit-function-return-type': 'off',
        // Allow async functions without await in tests (common for test setup)
        '@typescript-eslint/require-await': 'off',
      },
    },
  ],
};
