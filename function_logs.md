# Function Logs - FinCommerce Beta Console

This document outlines the functional modules, security guards, and sandbox tool behaviors implemented in the **franktest.xyz v1.1** release. This guide is prepared for beta testers validating the SaaS framework for **FinCommerce**.

---

## 1. Authentication & Gatekeeper Modules

### Authentication Hook
- **File**: [login.html](file:///f:/Projects/PythonProject/franktest.xyz/login.html)
- **Method**: Client-Side JavaScript Validation (`handleLogin`)
- **Credentials for Beta Testing**:
  - **Administrators** (Role: `admin` -> redirects to `dashboard.html`):
    - `sadminwa` / `sadminwa`
    - `sadmin` / `sadmin`
  - **Beta Testers** (Role: `tester` -> redirects to `test_portal.html`):
    - `tester01` through `tester10` with password `tester` (or `password-tester`)
- **Behavior**:
  - Successful attempts set a session token (`sessionStorage.setItem("sadmin_token", "active")`), store the username, and set `sadmin_role` to redirect the user to their appropriate dashboard or portal.
  - Unsuccessful attempts flag inputs with `.is-invalid` and show error prompts.

### Session Security Guards
- **Files**: [dashboard.html](file:///f:/Projects/PythonProject/franktest.xyz/dashboard.html) and [test_portal.html](file:///f:/Projects/PythonProject/franktest.xyz/test_portal.html)
- **Method**: Head Script Block Validation
- **Behavior**:
  - Validates `sadmin_token` state prior to document parsing.
  - Non-authenticated requests are blocked and immediately redirected back to `login.html`.

---

## 2. Beta Tester Portal & Project Constraints

### Admin Project Assignment manager
- **File**: [dashboard.html](file:///f:/Projects/PythonProject/franktest.xyz/dashboard.html)
- **Method**: "Manage Testers" Tab Controls
- **Behavior**:
  - Provides a project assignment dropdown for all 10 beta testers (`tester01` to `tester10`).
  - Assignments are saved in `localStorage.setItem("tester_assignments", JSON.stringify(assignments))`.
  - Initial configuration defaults `tester01` to the `FinCommerce` project and others to `None`.

### Project Filtering Restriction
- **File**: [test_portal.html](file:///f:/Projects/PythonProject/franktest.xyz/test_portal.html)
- **Scope constraint**: Beta testers can only see the project assigned to them by the administrator:
  - If a tester is assigned to `None`, access to the project panel is blocked, displaying a warning message.
  - If assigned to a SaaS project (like `FinCommerce`), the portal dynamically scopes all title headers, mock API endpoints, and response payloads to that project.

### Tester Tools & Feedback Submission
- **API Test Runner**: Simulates transactions and displays JSON payload payloads within an interactive CLI terminal box on the dashboard interface.
- **Feedback Logger**: Collects components tested and logs. Appends inputs to local history array (`localStorage.getItem("beta_feedback")`) for validation metrics.

---

## 3. SaaS Metrics & Monitoring Module

The dashboard panels aggregate simulated telemetry for **FinCommerce** integrations:

- **Active Connections**: Tracks the count of concurrent connections. Refreshed dynamically when simulations are run.
- **API Success Rate**: High-visibility metric displaying gateway endpoint success ratios (currently steady at `99.98%`).
- **Average Latency**: Response times for FinCommerce transaction requests (simulated baseline: `28ms`).
- **Billing Plans**: Overview of active test subscription statuses (initialized at `18 Active` Enterprise tier).

---

## 4. Sandbox Operations & Logging Console

### Live Operational Logs Table
- Displays real-time events triggered by the platform or initiated manually by testers.
- Logs include:
  - Timestamp (local system time).
  - Source component designation.
  - Event details/action text.
  - Status badge (e.g. `Success` in green, `Warning` in yellow).

### Interactive Sandbox Tool actions
Testers can trigger actions on the sidebar console to test live integrations:

1. **Simulate Transaction**: 
   - Appends a `FinCommerce Sandbox` success transaction log entry.
   - Dynamically increments the **Active Connections** metric count on the dashboard UI.
2. **Send API Query**:
   - Triggers a mock endpoint call to `/v1/commerce/products`.
   - Appends a log entry detailing the payload response status.
3. **System Health Check**:
   - Polls virtual server clusters.
   - Appends a log verifying node status.
