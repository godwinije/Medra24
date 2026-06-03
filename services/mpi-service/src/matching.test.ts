import { MatchingEngine } from './matching';
import { Patient } from '@omnihealth/fhir-types';

describe('MatchingEngine', () => {
    const patient1: Patient = {
        resourceType: 'Patient',
        name: [{ family: 'Doe', given: ['John'] }],
        birthDate: '1990-01-01',
        gender: 'male',
        telecom: [{ system: 'phone', value: '555-1234' }],
        identifier: [
            { system: 'urn:oid:2.16.840.1.113883.3.123', value: 'NAT123' }
        ]
    };

    const existingIdentifiers = [
        { system: 'urn:oid:2.16.840.1.113883.3.123', value: 'NAT123', goldenPatientId: 'golden-1' }
    ];

    test('should find deterministic match', () => {
        const result = MatchingEngine.findDeterministicMatch(patient1, existingIdentifiers);
        expect(result).not.toBeNull();
        expect(result?.goldenPatientId).toBe('golden-1');
        expect(result?.method).toBe('deterministic');
    });

    test('should calculate probabilistic score', () => {
        const goldenRecord = {
            id: 'golden-1',
            first_name: 'John',
            last_name: 'Doe',
            date_of_birth: '1990-01-01',
            gender: 'male',
            phone: '555-1234'
        };

        const score = MatchingEngine.calculateProbabilisticScore(patient1, goldenRecord);
        expect(score).toBeCloseTo(1.0); // Perfect match
    });

    test('should return lower score for partial match', () => {
        const goldenRecord = {
            id: 'golden-2',
            first_name: 'Johnny',
            last_name: 'Doe',
            date_of_birth: '1990-01-01',
            gender: 'male',
            phone: '555-4321'
        };

        const score = MatchingEngine.calculateProbabilisticScore(patient1, goldenRecord);
        expect(score).toBeGreaterThan(0.5);
        expect(score).toBeLessThan(1.0);
    });
});
