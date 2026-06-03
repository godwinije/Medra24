import { Patient, Identifier } from '@omnihealth/fhir-types';

export interface MatchResult {
    matched: boolean;
    goldenPatientId?: string;
    score: number;
    method: 'deterministic' | 'probabilistic';
}

export class MatchingEngine {
    /**
     * Deterministic matching based on high-confidence identifiers.
     */
    static findDeterministicMatch(patient: Patient, existingIdentifiers: { system: string, value: string, goldenPatientId: string }[]): MatchResult | null {
        if (!patient.identifier) return null;

        const highConfidenceSystems = [
            'urn:oid:2.16.840.1.113883.3.123', // National ID
            'http://hl7.org/fhir/sid/us-ssn'   // SSN
        ];

        for (const identifier of patient.identifier) {
            if (identifier.system && highConfidenceSystems.includes(identifier.system)) {
                const match = existingIdentifiers.find(i => i.system === identifier.system && i.value === identifier.value);
                if (match) {
                    return {
                        matched: true,
                        goldenPatientId: match.goldenPatientId,
                        score: 1.0,
                        method: 'deterministic'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Probabilistic matching using a simplified Fellegi-Sunter model.
     */
    static calculateProbabilisticScore(p1: Patient, p2: any): number {
        let score = 0;

        // Weights (Simplified)
        const weights = {
            firstName: 0.2,
            lastName: 0.3,
            dob: 0.3,
            gender: 0.1,
            phone: 0.1
        };

        // Name similarity
        if (p1.name && p1.name[0] && p2.first_name && p2.last_name) {
            if (p1.name[0].family === p2.last_name) score += weights.lastName;
            if (p1.name[0].given && p1.name[0].given[0] === p2.first_name) score += weights.firstName;
        }

        // DOB similarity
        if (p1.birthDate && p2.date_of_birth) {
            const d1 = new Date(p1.birthDate).toISOString().split('T')[0];
            const d2 = new Date(p2.date_of_birth).toISOString().split('T')[0];
            if (d1 === d2) score += weights.dob;
        }

        // Gender similarity
        if (p1.gender === p2.gender) score += weights.gender;

        // Phone similarity
        if (p1.telecom && p2.phone) {
            const phone1 = p1.telecom.find(t => t.system === 'phone')?.value;
            if (phone1 === p2.phone) score += weights.phone;
        }

        return score;
    }
}
