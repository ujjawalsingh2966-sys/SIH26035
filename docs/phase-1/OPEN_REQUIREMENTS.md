# Open Requirements & Defeatured Scope

## 1. Explicitly Open Requirements (Post-MVP)
The following requirements have been deliberately abstracted or left open to allow the MVP architectural baseline an unobstructed path to completion.

* **O-001 [Visual Branding]:** While the structural data blocks of the generated PDF perfectly match OIML R 76-2, the outer visual letterhead, departmental logos, and regional branding parameters are deliberately unresolved until final local stakeholder configuration.
* **O-002 [IT Act DSC Extensibility]:** The internal logic relies on a cryptographic SHA-256 seal. The exact API integration handler (e.g., eMudhra payload schemas) for swapping the internal seal to a distributed PKI signature remains open pending access to National Single Window System (NSWS) credentials.
* **O-003 [Complex Influence Tolerances]:** Temperature variation testing (OIML R 76-1, A.5.3) is deferred. The MVP assumes nominal unadjusted static laboratory conditions.

## 2. Frozen/Defeatured Scope (Not to be Built)
* Multi-interval parameters ($e_1$, $e_2$)
* Mechanical scale visual interpolation logic
* Live serial port (RS-232/USB) load-cell ingestion
* General retail billing architecture
