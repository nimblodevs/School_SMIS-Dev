import globals from 'globals';

export default [
    {
        ignores: ['node_modules/**', 'generated/**', 'coverage/**'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        rules: {
            'no-constant-condition': 'error',
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrors: 'none',
                },
            ],
        },
    },
];
