/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  setupFilesAfterEnv: [],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'hooks/**/*.ts',
    '!**/*.d.ts',
    '!lib/**/index.ts',
  ],
};
