// Jest configuration for TypeScript project
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { isolatedModules: true } }],
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

export default config;
