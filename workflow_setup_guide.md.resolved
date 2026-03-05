# Workflow Setup Guide

## Overview

The Workflow Setup page (under Admin) has 5 tabs that work together:

| Tab | Purpose |
|---|---|
| 1 Departments | Create/manage departments |
| 2 Roles | Define role names used in steps |
| 3 User → Role | Assign custom role tags to users |
| 4 Approval Sequences | Define steps per department/form type |
| 5 Approval Matrix | Map a specific user to a role per department |

**Rule of thumb:**
- **Tab 4** defines *what steps exist* and *what role each step requires*
- **Tab 5** defines *who exactly fills each role* (per department or globally)

---

## Scenario 1 — Department-Specific Approver (All Steps Per Department)

> *"Each department has its own supervisor who approves Step 1. IT Manager always handles Step 2."*

### Tab 4 — Approval Sequences

Add a configuration for each department (e.g., Finance, HR, Engineering):

| Step | Role | Status on Approval |
|---|---|---|
| Step 1 | `department_approver` | Department Approved |
| Step 2 | `it_manager` | IT Manager Approved |
| Step 3 | `service_desk` | Service Desk Processing |

> Repeat this same 3-step setup for each department. They can have the same role names.

### Tab 5 — Approval Matrix

Add one rule **per department** for Step 1 only:

| Form Type | Department | Role | Assigned User |
|---|---|---|---|
| Item Request | Finance | `department_approver` | Alice |
| Item Request | HR | `department_approver` | Bob |
| Item Request | Engineering | `department_approver` | Carol |

For Step 2 and Step 3, add **global** rules (so you only need to configure once):

| Form Type | Department | Role | Assigned User |
|---|---|---|---|
| Item Request | 🌐 Global | `it_manager` | John (IT Manager) |
| Item Request | 🌐 Global | `service_desk` | Service Desk Team |

---

## Scenario 2 — One User Approves Multiple Departments (Step 1)

> *"John is the department approver for Finance, Engineering, and HR."*

### Tab 4 — Approval Sequences

Same as Scenario 1 (3-step setup per department).

### Tab 5 — Approval Matrix

Add 3 rules — one per department, same user:

| Form Type | Department | Role | Assigned User |
|---|---|---|---|
| Item Request | Finance | `department_approver` | John |
| Item Request | Engineering | `department_approver` | John |
| Item Request | HR | `department_approver` | John |

> John will see requests from all 3 departments in his inbox since his visibility now covers all assigned departments.

---

## Scenario 3 — Mixed: Global Step 1, Specific on Step 2

> *"Step 1 uses the same global approver for all departments. Step 2 uses a department-specific endorser."*

### Tab 4 — Approval Sequences

Add the same 2-step config to each department (or use a default global workflow):

| Step | Role | Status on Approval |
|---|---|---|
| Step 1 | `pre_approver` | Pre-Approved |
| Step 2 | `dept_endorser` | Department Endorsed |

### Tab 5 — Approval Matrix

Step 1 → Global (one rule covers all):

| Form Type | Department | Role | Assigned User |
|---|---|---|---|
| Item Request | 🌐 Global | `pre_approver` | Maria (Global Pre-Approver) |

Step 2 → Department-specific:

| Form Type | Department | Role | Assigned User |
|---|---|---|---|
| Item Request | Finance | `dept_endorser` | Alice |
| Item Request | HR | `dept_endorser` | Bob |
| Item Request | Engineering | `dept_endorser` | Carol |

**Result:** All requests hit Maria first (Step 1), then route to the department-specific endorser (Step 2).

---

## Scenario 4 — Fully Global (Same Approvers for All Departments)

> *"Every request goes through the same chain regardless of department."*

### Tab 4 — Approval Sequences

Add a **single default workflow** (no department selected — click "+ Add Global (All Departments)"):

| Step | Role | Status on Approval |
|---|---|---|
| Step 1 | `department_approver` | Department Approved |
| Step 2 | `it_manager` | IT Manager Approved |
| Step 3 | `service_desk` | Service Desk Processing |

### Tab 5 — Approval Matrix

Add only global rules:

| Form Type | Department | Role | Assigned User |
|---|---|---|---|
| Item Request | 🌐 Global | `department_approver` | John |
| Item Request | 🌐 Global | `it_manager` | Maria |
| Item Request | 🌐 Global | `service_desk` | IT Desk |

**Result:** Every request from any department follows the same exact chain → John → Maria → IT Desk.

---

## Lookup Priority (How the System Resolves Approvers)

When a request is submitted, here is the order the system checks:

```
1. Does an Approval Matrix rule exist for this (form_type + department + role)?
   → YES: Use that specific user
   → NO ↓

2. Does a GLOBAL Approval Matrix rule exist for this (form_type + null dept + role)?
   → YES: Use that global user
   → NO ↓

3. Are there users in the requestor's department who have this custom role tag?
   → YES: Use those users
   → NO: ❌ Error — no approver found
```

---

## Tips

> [!TIP]
> Use **Global rules for IT Manager and Service Desk** — they rarely change per department, so a global rule saves setup time.

> [!TIP]
> Use **Department-specific rules for Step 1** — the first approver is almost always department-specific.

> [!IMPORTANT]
> The **role name in Tab 4 (Approval Sequences)** must **exactly match** the role name in Tab 5 (Approval Matrix). Case-sensitive. Example: `department_approver` ≠ `Department_Approver`.

> [!NOTE]
> A user can be an approver for multiple departments by adding multiple matrix rules (one per department) pointing to the same user. Their request inbox will show all assigned departments' requests automatically.
