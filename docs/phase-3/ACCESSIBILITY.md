# Accessibility Considerations

As a laboratory enterprise tool, the NAWI evaluation platform must adhere to baseline workflow accessibility expectations, ensuring data entry integrity mapping to WCAG abstractions.

## 1. No Color-Only Communication
Statutory verdict displays (`PASS`, `FAIL`, `BLOCKED`) must explicitly render semantic text outputs. A green background alone is legally inadequate for communicating mathematical passes to color-blind stakeholders or print-only compliance archives.

## 2. Keyboard Workflow Ascendancy
Testing modules demand massive data entry matrices. The platform strictly expects full workflow capabilities (creating tests, entering numbers, submitting approvals) via keyboard.
* Arrow-key navigation inside testing matricies is highly recommended.
* Trapped focus instances inside dialog menus must be prevented.

## 3. High Contrast Mandates
* The distinction between User-Editable variables (white/light backgrounds) and Machine-Calculated variables (grey/shaded domains) necessitates a minimum contrast ratio of 4.5:1.
* Inactive tests or conditionally skipped domains must appear disabled but remain textually readable.

## 4. Semantic Table Structuring
Given that OIML R76 evaluation mathematically relies on structured grids, all observations must utilize true `<th>`, `<tr>`, and `<td>` abstractions readable natively by screen-readers, rather than arbitrary floating flex-boxes masking data-structures.

## 5. Explicit Error Hooking
Form validation rejections (like exceeding physical boundaries or throwing `Domain Errors`) must snap user focus directly to the rejected input label, appending `aria-invalid="true"`.
