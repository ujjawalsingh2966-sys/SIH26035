# Requirements Changelog (v0.1 to v0.2)
This document outlines explicit requirement modifications made during the Phase 1 SRS extraction process.

## 1. Modifications

| Change ID | Feature / Component | v0.1 Status | v0.2 Final Status | Rational / Source |
| :--- | :--- | :--- | :--- | :--- |
| **CHG-001** | Instrument Inclusion Scope | Assumed all general 'NAWI' encompassing mechanicals and potentially multi-intervals. | Restricted exclusively to Electronic, Single-Range NAWI (Classes I, II, III, IIII). | Phase 0 Scope Matrix; simplification of the algorithmic data grid UI. |
| **CHG-002** | Report Template Schema | "TBD - Awaiting RRSL Template". | OIML R 76-2:2007 structural compliance mandated. | Indian Legal Metrology mimics international report data schemas. |
| **CHG-003** | Digital Signatures | Ambiguous IT Act DSC dependency. | Internal cryptographic SHA-256 seal mandated for MVP. | Decouples standard MVP development from missing national PKI credentials. |
| **CHG-004** | Floating-Point Math | Unspecified primitive usage. | Strictly prohibited; Arbitrary-precision decimals explicitly enforced. | Eliminates silent edge-case failures during OIML MPE boundary calculations. |
| **CHG-005** | Hardware Interfacing | Ambiguous potential for "IoT serial polling". | Banned from Phase 1 scope; manual UI transcription enforced. | Hardware driver development risks compromising core metrological algorithm development timelines. |

## 2. Requirements Deprecated
* Legacy data ingestion modules are fully deprecated from Phase 1 scope. The MVP handles strictly newly created electronic compliance tests.
* Mechanical interval interpolation components are removed from initial schemas.
