-- MPI Service Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Golden Patient Records
CREATE TABLE IF NOT EXISTS golden_patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT,
    last_name TEXT,
    date_of_birth DATE,
    gender TEXT,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- External Identifiers linked to Golden Records
CREATE TABLE IF NOT EXISTS patient_identifiers (
    id SERIAL PRIMARY KEY,
    golden_patient_id UUID REFERENCES golden_patients(id) ON DELETE CASCADE,
    system TEXT NOT NULL, -- e.g., urn:oid:facility-1
    value TEXT NOT NULL,  -- e.g., MRN-12345
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(system, value)
);

-- Potential Matches for manual review (Gray Zone)
CREATE TABLE IF NOT EXISTS potential_matches (
    id SERIAL PRIMARY KEY,
    source_patient_json JSONB NOT NULL,
    matched_golden_patient_id UUID REFERENCES golden_patients(id),
    score DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for merges and unmerges
CREATE TABLE IF NOT EXISTS identity_audit_log (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL, -- merge, unmerge, create, update
    golden_patient_id UUID,
    details JSONB,
    performed_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_name ON golden_patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_dob ON golden_patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_identifiers_lookup ON patient_identifiers(system, value);
