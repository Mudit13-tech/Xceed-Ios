module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],

  ignorePatterns: ['dist', '.eslintrc.cjs'],
  // Build tooling runs in Node, not the browser, so `process` and `Buffer` are
  // real there and undefined everywhere else. Scoped rather than added to the
  // top-level env, which would stop the app's own code being checked for them.
  overrides: [
    {
      files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
      env: { node: true, browser: false },
    },
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',
    'no-unused-vars': 'off',
  },
};
