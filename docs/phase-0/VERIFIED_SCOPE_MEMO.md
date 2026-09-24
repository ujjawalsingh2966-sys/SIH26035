# Verified Scope Memo
**Status:** DRAFT VERIFIED
**Phase:** 0

## 1. Description of the System
The Automated NAWI Compliance & Reporting System (ANCRS) is a web-based compliance evaluation platform tailored to digitize the physical testing and calculation workflows for scale models based on metrological standards. It systematically captures test observations, performs deterministic precision evaluations against specified regulatory thresholds, enforces rigorous approval state machines, and produces legally formatted test reports.

## 2. Intended Users
* **Laboratory Technicians:** Individuals responsible for executing the physical tests at testing facilities such as RRSLs or NPL, and inputting observations.
* **Reviewing Officers / Verifiers:** Authorized metrology officers who inspect documented inputs and compliance trace records prior to freezing the test data.
* **System Administrators:** Staff maintaining rules versions, MPE lookup configurations, and system identities.

## 3. Supported Instruments (Initial Scope / MVP)
* Electronic **Non-Automatic Weighing Instruments (NAWI)** configured as single-range.
* Applicable types include retail, bench, and static platform scales under Accuracy Classes I, II, III, and IIII.

## 4. Excluded Instruments
* **Automatic Weighing Instruments (AWI)** (e.g., weigh-in-motion, conveying checkweighers, volumetric fillers) are strictly out of scope.
* Mechanical NAWIs.
* Multi-interval and multiple-range NAWIs are excluded from the MVP phase.

## 5. Central OIML Framework
The central governing international metrology document is **OIML R 76-1 Edition 2006 (E)**: *Non-automatic weighing instruments - Part 1: Metrological and technical requirements - Tests*.

## 6. Governing Indian Legal Documents
The regulatory baseline under Indian jurisdiction is composed of:
* **The Legal Metrology Act, 2009** (Act 1 of 2010).
* **The Legal Metrology (Approval of Models) Rules, 2011**.
* **The Legal Metrology (General) Rules, 2011**.

## 7. Extraneous Physical Activities
The software assumes human execution of tasks including:
* Setting up testing weights, manipulating loads on physical scale pans.
* Calibrating load cells or hardware balances.
* Interfacing with physical environmental chambers to control humidity/temperature bounds.

## 8. Verified Software Digitization Scope
The software scope is strictly constrained to defining instrument configurations, digitizing observation data sets, deploying mathematically precise calculation matrices to determine errors and tolerances (MPE), applying Pass/Fail states, capturing review approvals with a cryptographic seal, and producing PDF test outcomes.

## 9. Explicit Constraints Not in MVP
* Hardware integration, RS-232, serial extraction, IoT load cell syncing, sensor aggregation.
* Probabilistic AI logic.
* Automated legacy Excel report migration.

## 10. Components Explicity Marked as TBD
* **Official Report Template Boundary:** Has the Indian government precisely declared a specific template format under the Seventh Schedule or similar gazetted documentation?
* **Digital Signatures:** Do signed PDFs require Information Technology Act compliant remote/digital signing (e.g., Aadhaar eSign, DSC USB dongle) or a standard cryptographic digital watermark issued by the application?
