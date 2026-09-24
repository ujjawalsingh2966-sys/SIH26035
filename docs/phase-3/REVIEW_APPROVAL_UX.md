# Review and Approval UX

The Approver phase is a read-only architectural validation zone. Its core mandate is transparency protecting against blindly stamping statutory documents.

## 1. Contextual Workspace Summary
Reviewers dropping into a returned evaluation land on a Summary Dashboard containing:
* The active specific metrological Rule Identifier determining logic behavior (e.g. `Engine Vol: OIML 2006 Core V1.2.9`).
* High-level `PASS` or `BLOCKED` meta-states matching `COMPLIANCE_DECISION_SPECIFICATION.md`.
* Tabbed structures allowing deep-dives into the Technician's specific Observation Modules.

## 2. Immutability
Reviewers hold absolute structural blocks against modifying raw inputs. 
* A typo spotted internally ($I = 50000$ instead of $5000$) must be formally bounced backward. 

## 3. Explanatory Result Hovers
A simple standard boolean `FAIL` visual marker isn't enough. When Reviewers hover or click the compliance output, the `Explainability Specification` trace opens formally. 
* Expanding the tag shows: `Absolute(+2.5e) limits Table 6 Max(+1.0e). Condition Failure verified.` 

## 4. The Action Anchor
The fixed screen footer anchors contextual buttons strictly aligned to state machines:
* **`APPROVE & SEAL`**: Irrevocably sets the test into History, allowing PDF templates to generate dynamically.
* **`RETURN FOR MODIFICATION`**: Disables testing temporarily, opens a mandatory dialog prompting reasons, and shunts responsibility directly back to the originator.
* **`VIEW EVIDENCE`**: Opens side-drawers checking related attachments.
