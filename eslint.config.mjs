import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        files: ['*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {global: 'readonly', console: 'readonly',
                TextDecoder: 'readonly', TextEncoder: 'readonly'},
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}],
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
];
