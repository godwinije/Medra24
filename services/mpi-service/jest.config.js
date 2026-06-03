module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@omnihealth/fhir-types$': '<rootDir>/../../team/shared/packages/fhir-types/src/index',
    '^@omnihealth/id-gen$': '<rootDir>/../../team/shared/packages/id-gen/src/index',
  },
};
