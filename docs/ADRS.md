# Architecture Decision Records (OmniHealth)

This file catalogs all ADRs for quick reference. Full details in [ARCHITECTURE.md](./ARCHITECTURE.md#10-key-architecture-decisions-adrs).

| ADR | Title | Decision | Status |
|-----|-------|----------|--------|
| ADR-001 | Message Queue Choice | **Apache Kafka** over RabbitMQ | ✅ Accepted |
| ADR-002 | Primary Clinical Store | **MongoDB + PostgreSQL** dual-write | ✅ Accepted |
| ADR-003 | Repository Architecture | **Polyrepo** with shared npm packages | ✅ Accepted |
| ADR-004 | API Gateway | **Kong Gateway** (OSS) | ✅ Accepted |
| ADR-005 | Patient Identity | **Deterministic + Probabilistic** (Fellegi-Sunter) | ✅ Accepted |
| ADR-006 | Patient Portal Pattern | **FHIR Proxy** via Consent & Proxy Service | ✅ Accepted |

### ADR Template (for future decisions)

```markdown
### ADR-NNN: Title

**Status:** [Proposed | Accepted | Deprecated | Superseded]
**Context:** Why this decision is needed
**Decision:** What we chose
**Rationale:** Why we chose it, with key factors
**Consequences:** Trade-offs, costs, and follow-up work
**Alternatives Considered:** Other options and why they were rejected
```