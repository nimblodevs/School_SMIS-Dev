export default [
    {
        ignores: ['node_modules/**', 'coverage/**', 'prisma/migrations/**'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                Buffer: 'readonly',
                URL: 'readonly',
                clearInterval: 'readonly',
                clearTimeout: 'readonly',
                console: 'readonly',
                process: 'readonly',
                setInterval: 'readonly',
                setTimeout: 'readonly',
            },
        },
        rules: {
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
        },
    },
];
