# Scope Decision Matrix

| Instrument / Capability | Decision | Evidence | Reason | Future Phase |
| :--- | :--- | :--- | :--- | :--- |
| **Retail electronic NAWI** | IN SCOPE | OIML R76, LM Act | Fundamental target of NAWI Model regulations representing the vast majority of scale testing. | N/A |
| **Platform NAWI** | IN SCOPE | OIML R76, LM Act | Defined as NAWI under R76; identical mathematical matrices apply. | N/A |
| **Static weighbridge** | IN SCOPE | OIML R76, LM Act | Standard inclusion under NAWI rules, albeit spanning significantly higher Max loads. | N/A |
| **Single-Range Instruments** | IN SCOPE | OIML R76 | MVP Core capable of linear interval processing over simple $e$ bounds. | N/A |
| **Mechanical NAWI** | OUT OF SCOPE | Engineering Constraints | Do not utilize changeover point $\Delta L$ method for error bound calculations. | Phase 2+ |
| **Multiple-Range/Multi-Interval** | MVP-DEFERRED | Complexity Constraints | Interval shifts ($e_1, e_2$) drastically multiply test configuration permutations. | Phase 2+ |
| **Automatic checkweigher** | OUT OF SCOPE | OIML R51 | Qualifies explicitly as AWI entirely bypassing R76 formulations. | Unlikely |
| **Weigh-in-motion scale** | OUT OF SCOPE | OIML R134 | Qualifies as AWI (dynamic weighing), rendering R76 tests technically unviable. | Unlikely |
| **Test: Weighing Performance A.4.4** | IN SCOPE | OIML R76-1 | Core validation of MPE limits. | N/A |
| **Test: Repeatability A.4.10** | IN SCOPE | OIML R76-1 | Mandatory variance testing. | N/A |
| **Test: Eccentricity A.4.7** | IN SCOPE | OIML R76-1 | Mandatory corner load consistency testing. | N/A |
| **Test: Tare A.4.6** | IN SCOPE | OIML R76-1 | Mandatory net indication testing. | N/A |
| **Test: Zero-setting A.4.2** | IN SCOPE | OIML R76-1 | Base initial indication testing. | N/A |
| **Hardware capture / Serial Port** | OUT OF SCOPE | Engineering Constraints | Adding physical IoT boundaries introduces massive hardware discrepancy risk disrupting the core calculation valuation MVP. Data entered via technician UI. | Phase 2+ |
| **Sensor integration (Temp/Hum.)** | OUT OF SCOPE | System Complexity | Analogous to hardware capture, testing assumes manual laboratory condition verification forms initially. | Phase 2+ |
| **Govt. Portal integration (NSWS)** | OUT OF SCOPE | System Independence | Operates as isolated sandbox at laboratory layer for MVP. Report outputs manually utilized. | Phase 3+ |
| **Digital signatures (DSC / eSign)** | MVP-DEFERRED | Integration Ambiguity | Internal SHA-256 seal satisfies immutable requirement; external IT Act DSC APIs deferred. | Phase 3+ |
| **Offline operation** | IN SCOPE | Lab Conditions | Metrology labs frequently experience network drops; drafting observations requires local IndexedDB capability. | N/A |
| **Historical Rule Versioning** | IN SCOPE | Audit Necessity | Strict immutability requirement so past reports do not alter status when OIML rules update globally. | N/A |