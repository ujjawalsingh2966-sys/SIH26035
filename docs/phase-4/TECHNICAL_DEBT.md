# TECHNICAL DEBT REGISTER

| Item | Reason | Targeted Replacement Phase | Risk to keep |
| :--- | :--- | :--- | :--- |
| Mock Development Login | Temporary auth to satisfy Phase 4 UI constraints without SQL schemas | Phase 5 | HIGH. Must be replaced prior to staging launch |
| Missing Database | Schema specifications defer to true mapping of Phase 2 | Phase 5 | NONE |
| In-Memory Mock Testing | Smoke tests only validate HTTP layout, rather than Domain evaluation speeds | Phase 5 | NONE |
