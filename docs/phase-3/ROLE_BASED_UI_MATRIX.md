# Role-Based UI Matrix

This matrix governs the visible permissions and explicit capabilities mapped generically across the UI interfaces for inferred roles. 

*Note: Visual suppression acts as UX guidance; exact functional restriction is driven natively via backend architecture defined post-Phase 3.*

| Screen / Feature | Technician | Approver (Reviewer) | Administrator / Auditor |
| :--- | :--- | :--- | :--- |
| **Dashboard** | View active/drafts | View pending reviews / queues | View entire unassigned scope |
| **Test Case Creation** | Full Access (Create) | Read-only | Read-Only |
| **Instrument Specs** | Edit & Assign | Read-only | Edit Global Defaults |
| **Observations Matrix**| Edit, Save, Submit | Read-only | Read-only |
| **Review Result Trace**| Read-only (Preview) | Expanding Trace & Validation Details | Expanding Trace |
| **Status Reversion** | Cancel (Drafts) | Return for Mod (Pending checks) | Override Access (Admin) |
| **Final Test Approval**| Hidden / Disabled | Full Access (Submit) | Override (Approval) |
| **Report Generation** | View / Print | Generate / Finalize | Regenerate Historics |
| **Rule Version Engine**| Hidden | Hidden | Toggle Active Defaults |
| **Audit Logs** | Hidden | Basic Timeline views | Full Metadata Traces |
