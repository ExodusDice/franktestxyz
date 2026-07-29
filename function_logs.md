# Function Logs - FinCommerce Beta Console

This document outlines the functional modules, security guards, and sandbox tool behaviors implemented in the **franktest.xyz v1.1** release. This guide is prepared for beta testers validating the SaaS framework for **FinCommerce**.

---

## 1. Authentication & Gatekeeper Modules

### Admin Authentication Hook
- **File**: [login.html](file:///f:/Projects/PythonProject/franktest.xyz/login.html)
- **Method**: Client-Side JavaScript Validation (`handleLogin`)
- **Credentials for Beta Testing**:
  - **Username**: `sadminwa`
  - **Password**: `sadminwa`
- **Behavior**:
  - Successful attempts set a session token (`sessionStorage.setItem("sadmin_token", "active")`) and redirect the browser to `dashboard.html`.
  - Unsuccessful attempts flag target input elements with the `.is-invalid` class, trigger custom red CSS border highlights, and display the error prompt.

### Session Security Guard
- **File**: [dashboard.html](file:///f:/Projects/PythonProject/franktest.xyz/dashboard.html)
- **Method**: Head Script Block Validation
- **Behavior**:
  - Validates `sadmin_token` state prior to document parsing.
  - Non-authenticated requests are blocked and immediately redirected back to `login.html`.

---

## 2. SaaS Metrics & Monitoring Module

The dashboard panels aggregate simulated telemetry for **FinCommerce** integrations:

- **Active Connections**: Tracks the count of concurrent connections. Refreshed dynamically when simulations are run.
- **API Success Rate**: High-visibility metric displaying gateway endpoint success ratios (currently steady at `99.98%`).
- **Average Latency**: Response times for FinCommerce transaction requests (simulated baseline: `28ms`).
- **Billing Plans**: Overview of active test subscription statuses (initialized at `18 Active` Enterprise tier).

---

## 3. Sandbox Operations & Logging Console

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
