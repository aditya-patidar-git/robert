/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['js', 'mjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup/jest.setup.js'],
  moduleNameMapper: {
    '^mongoose$': '<rootDir>/node_modules/mongoose',
  },
  resetModules: false,
  collectCoverageFrom: [
    'robert-agent-service/src/services/**/*.js',
    'robert-agent-service/src/handlers/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
  testTimeout: 10000,
  maxWorkers: 1,
  verbose: true,
};
