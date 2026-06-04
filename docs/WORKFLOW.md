<!-- managed:linked-repos -->
## Linked Repositories
- godwinije/Medra24
<!-- /managed:linked-repos -->

# OmniHealth — Code Workflow

## Repository
- **Single repo:** `godwinije/Medra24` (monorepo structure for now — can split into polyrepo later)
- **Branch strategy:** `main` is protected. Feature branches → PR → merge to main.

## Structure in Repo
```
medra24/
├── packages/          # @omnihealth/* shared libraries
├── services/
│   ├── mpi-service/          # Patient identity matching
│   ├── fhir-api-service/     # FHIR R4 CRUD API
│   └── ingestion-adapter/    # HL7 v2 / FHIR ingestion
├── portals/
│   └── provider-dashboard/   # Vite + React SPA
├── infrastructure/
│   ├── terraform/            # VPC + EKS modules
│   ├── gitops/               # ArgoCD configs
│   ├── helm/                 # Helm charts
│   ├── dev/                  # Docker Compose
│   └── ci/                   # GitHub Actions templates
├── docs/                     # Architecture, design, ADRs
└── shared/                   # Planning artifacts
```

## Process
1. Create a feature branch from `main`
2. Commit code, push branch
3. Open a PR against `main`
4. Lead reviews and merges (squash)