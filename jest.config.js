module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^expo-sqlite$': '<rootDir>/tests/mocks/expo-sqlite.ts',
    '^expo-file-system/legacy$': '<rootDir>/tests/mocks/expo-file-system.ts',
    '^expo-file-system$': '<rootDir>/tests/mocks/expo-file-system.ts',
    '^expo-sharing$': '<rootDir>/tests/mocks/expo-sharing.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};
