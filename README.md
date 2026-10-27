# VORLDX EMPLOYEE ATTENDANCE SYSTEM
**Organization:** VORLDX INDUSTRIES PRIVATE LIMITED  
**Type:** Internship Project — Full Stack MERN Application  
**Version:** 1.0.0  

---

## 1. Project Overview

The **VorldX Employee Attendance System** is an enterprise-grade, full-stack web application developed for **VorldX Industries Private Limited**. It streamlines daily employee check-in and check-out workflows using dynamic, office-stationed QR display kiosks, alongside self-service Work From Home (WFH) application pipelines, HR administrative supervision, policy enforcement, and audit trail compliance.

The system replaces manual registers and error-prone biometric hardware with a software-driven solution built on the **MERN** (MongoDB, Express.js, React, Node.js) stack. Employees scan auto-refreshing kiosk QR codes using their mobile smartphones or laptops to log attendance with automated late-arrival calculations. HR administrators have real-time visibility through live dashboards, employee directory controls, attendance record corrections, policy configuration, and CSV export capabilities.

---

## 2. Features List

### HR Admin Features
* **Live Operational Dashboard:** Real-time metrics on total workforce headcount, present employees, late arrivals, WFH participants, pending requests, department breakdowns, and 7-day attendance trends.
* **Employee Management:** Directory view with search, department filtering, employee creation, profile edits, and instant account activation/deactivation.
* **Attendance Oversight & Record Corrections:** Complete organizational attendance logs with manual correction workflows (minimum 10-character rationale required and strict audit logging of previous vs. new values).
* **WFH Approvals:** Centralized queue to approve or reject employee remote-work requests with mandatory administrative feedback notes.
* **Attendance Policy Engine:** Configurable grace periods, daily cutoff hours, monthly WFH quotas, required advance notice windows, and half-day/full-day duration thresholds.
* **QR Display Kiosk Management:** Provision, pair, monitor, activate, or deactivate lobby/office display terminals.
* **Audit Trail Viewer:** Comprehensive, immutable record of all security-sensitive events (logins, OTP verifications, QR token generations, attendance scans, corrections, and policy updates).
* **Reporting & CSV Export:** Filtered historical attendance reports with summary statistics and 1-click CSV file downloads.

### Employee Features
* **Verified QR Attendance:** Employee check-in and check-out require a current office kiosk QR and a fresh GPS fix within 50 meters. The office tablet captures attendance evidence; the employee phone camera is used only to scan the QR.
* **Real-Time Attendance Status:** Visual confirmation of check-in timestamp, shift schedule, working minutes, and late arrival alerts (computed against assigned shift grace periods).
* **Self-Service Attendance History:** Searchable, paginated record of daily check-ins, check-outs, status indicators, and past administrative adjustments.
* **WFH Application & Tracking:** Date-picker driven WFH application with automatic eligibility validation, monthly quota counter, and status tracking (Pending, Approved, Rejected).
* **User Profile & Shift Information:** Dedicated view of employee ID, work type (Office, Hybrid, Remote), assigned work shift, and departmental metadata.

### Dynamic QR System
* **Dynamic Ephemeral Tokens:** Cryptographically random 32-byte tokens hashed via SHA-256 and stored with 30-second validity periods.
* **Supervisor-Managed Kiosk:** Kiosk token issuance requires an authenticated HR Admin or Super Admin, and each display must be activated from QR Displays.
* **Atomic Per-Employee Claims:** A live QR can serve multiple employees during its short validity window, but each employee can use that token only once. Attendance records retain kiosk, supervisor, GPS distance, GPS accuracy, and verification timestamps without storing the employee's exact coordinates.
* **Strict Geofence:** The server enforces a fixed 50-meter radius and rejects GPS fixes worse than the configurable accuracy threshold (20 meters by default).
* **Tablet Camera Evidence:** The supervisor starts the kiosk and grants camera permission. The kiosk polls for a capture request, captures one live image from its tablet camera, and sends that image for attendance processing. The image is evidence only; face recognition and liveness detection are not implemented.
* **Kiosk Capture Requests:** Mobile-to-tablet coordination uses authenticated HTTPS polling (one-second kiosk polling), with a single active request per display. Offline captures are not stored or accepted.
* **Automatic Database Purging:** MongoDB TTL indexes automatically garbage-collect expired QR tokens and capture-request records 60 seconds after expiration.

### Kiosk deployment requirements
* Serve the client and API over HTTPS (or localhost during development); browser camera and geolocation APIs require a secure context.
* Open the QR display URL on the tablet while signed in as an HR Admin or Super Admin, then choose **Start Attendance** and allow camera access.
* Keep the kiosk browser tab open, its screen awake, and the camera permission enabled. Camera failures are reported and do not create attendance records.
* GPS coordinates are configured globally in Attendance Policies. The 50-meter radius is fixed; device-reported GPS can be spoofed and is not proof of physical presence.
* Captured images currently use the existing attendance record photo fields in MongoDB. Configure appropriate database access and retention; a separate managed image store and face-verification service are not included.

### Work From Home (WFH) System
* **Automated Eligibility Engine:** Restricts WFH requests based on employee work model (`hybrid` or `remote`), monthly limits, and advance notice policies.
* **Bi-Directional Conflict Prevention:** Once WFH is approved for a given day, on-site QR check-in is locked out for that date to prevent double counting.
* **Seamless Attendance Sync:** Approved WFH dates automatically register as attendance records on that date with `wfh` status.

### Reporting & Analytics
* **Department Breakdown:** Live aggregation of attendance distribution across Engineering, Marketing, Finance, and Human Resources.
* **Multi-Factor Filtering:** Filter by date ranges, departments, employee IDs, and status classifications (`present`, `late`, `wfh`, `incomplete`).
* **CSV Export:** RFC 4180-compliant comma-separated value streaming download for external payroll and ERP integration.

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React.js | 18.2.0 | Reactive user interface & component architecture |
| **Build Tool** | Vite | 5.0.4 | Rapid HMR frontend development & optimized bundling |
| **Styling & Design** | Tailwind CSS | 3.3.6 | Custom corporate UI design system |
| **Routing** | React Router DOM | 6.20.0 | Client-side routing, protected routes, role-based guards |
| **HTTP Client** | Axios | 1.6.2 | Promise-based API requests with interceptors & cookies |
| **QR Code Scanner** | html5-qrcode | 2.3.8 | Cross-browser HTML5 camera and canvas QR scanner |
| **QR Code Generator** | qrcode | 1.5.3 | Client and kiosk QR code canvas and image generation |
| **Icons** | Lucide React | 0.294.0 | UI iconography |
| **Charts** | Recharts | 2.10.1 | Responsive dashboard charts and trend visualizations |
| **Backend Runtime** | Node.js | 18+ LTS | Server-side JavaScript execution environment |
| **Web Server Framework**| Express.js | 4.18.2 | RESTful API server, routing, and middleware pipeline |
| **Database** | MongoDB | 6.0+ | Document-oriented NoSQL database |
| **Object Data Modeling**| Mongoose | 7.6.3 | Schema definitions, model validations, and aggregation |
| **Authentication** | JSON Web Tokens (jsonwebtoken) | 9.0.2 | Stateless JWT session tokens |
| **Password Security** | bcryptjs | 2.4.3 | Salted hashing for passwords and challenge verification |
| **Rate Limiting** | express-rate-limit | 7.1.5 | Protection against brute-force and token harvesting |
| **CSV Generation** | csv-writer | 1.6.0 | Structured streaming CSV export |
| **Date & Timezone** | date-fns & date-fns-tz | 2.30.0 / 2.0.0 | Timezone-aware date normalization (Asia/Kolkata) |

---

## 4. Prerequisites

Before installing and running the application, ensure the following software is installed on your workstation:

* **Node.js:** Version `18.0.0` or higher (Download: [nodejs.org](https://nodejs.org/))
* **npm:** Version `9.0.0` or higher (bundled with Node.js)
* **MongoDB:** Version `6.0` or higher Community Server (Download: [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community))
* **Git:** (Optional, for repository version control)
* **Supported OS:** Windows 10/11, macOS (Intel/Apple Silicon), or Linux (Ubuntu 20.04+)

---

## 5. Installation (Step-by-Step for Windows)

Open **PowerShell** or **Command Prompt** as Administrator or a standard user with folder write permissions.

### Step 1: Open Project Directory
```powershell
cd "C:\Users\VorldX Team\OneDrive\Desktop\project atten"
```

### Step 2: Install Backend Dependencies
```powershell
cd server
npm install
```

### Step 3: Install Frontend Dependencies
```powershell
cd ..\client
npm install
```

### Step 4: Configure Backend Environment Variables
In the `server` directory, copy `.env.example` to create `.env`:
```powershell
cd ..\server
copy .env.example .env
```
Open `server\.env` in your text editor and ensure the values match your local setup (default settings are pre-configured for local development).

### Step 5: Configure Frontend Environment Variables
In the `client` directory, copy `.env.example` to create `.env`:
```powershell
cd ..\client
copy .env.example .env
```
Verify that `VITE_API_URL` points to `http://localhost:5000/api/v1`.

---

## 6. MongoDB Setup

The VorldX Attendance System requires an active MongoDB database instance running locally or via MongoDB Atlas.

### Starting Local MongoDB on Windows

#### Option A: Windows Service (Standard Installation)
If MongoDB was installed with "Install MongoDB as a Service" checked:
```powershell
net start MongoDB
```

#### Option B: Manual Process Execution
If MongoDB is installed standalone without the Windows Service enabled:
```powershell
# Create data directory if it does not already exist
md C:\data\db

# Launch mongod process (keep this terminal open)
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath="C:\data\db"
```

#### Option C: Verification
Verify connectivity using `mongosh` or through your browser:
```powershell
mongosh --eval "db.adminCommand('ping')"
```
Output should return `{ ok: 1 }`.

---

## 7. Environment Variables

### Backend Configuration (`server/.env`)

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `PORT` | `5000` | Port on which the Express REST API listens |
| `MONGODB_URI` | `mongodb://localhost:27017/vorldx-attendance` | MongoDB connection URI string |
| `JWT_SECRET` | `your_super_secret_jwt_key_change_this_in_production` | Cryptographic secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration (e.g., `7d`, `24h`) |
| `JWT_COOKIE_EXPIRES_IN`| `7` | Duration in days for client httpOnly auth cookie |
| `CLIENT_URL` | `http://localhost:5173` | Allowed origin for Cross-Origin Resource Sharing (CORS) |
| `SUPERADMIN_EMAIL` | `vorldxteam@gmail.com` | Email allowed for the configured Super Admin sign-in |
| `SUPERADMIN_PASSWORD_HASH` | (required for Super Admin login) | bcrypt hash of the Super Admin password; keep the plaintext password out of source control |
| `BREVO_API_KEY` | (required for email delivery) | Private Brevo API/SMTP key used for OTP and admin invitation emails |
| `SMTP_USER` | (required for SMTP fallback) | Brevo SMTP login name used if the API email attempt fails |
| `EMAIL_FROM` | VorldX Attendance sender | Verified sender shown in email messages |
| `QR_TOKEN_EXPIRES_SECONDS` | `30` | Lifespan in seconds for dynamic kiosk QR codes |
| `QR_REFRESH_INTERVAL_SECONDS` | `30` | Polling/refresh frequency for kiosk display screens |
| `DEMO_MODE` | `true` | Enables local developer helper fields (e.g. `demoOTP` in API responses) |

To configure the Super Admin password, run this command from the `server` directory:

```powershell
npm run setup:superadmin
```

The setup prompt accepts the password without echoing it, saves only its bcrypt hash to the ignored `server/.env`, and never prints the hash. Restart the backend afterwards. On the first successful sign-in, the configured account is provisioned/promoted in MongoDB automatically. Never commit `.env` or share the password/hash.

The **Admin Invites** menu is available only to Super Admins. Email delivery requires a private `BREVO_API_KEY` in `server/.env`; configure a verified `EMAIL_FROM` sender, and set `SMTP_USER` if you want SMTP fallback. The invite email does not contain the password: provide it to the invited administrator through a separate secure channel. Any mail-provider key previously stored in application source should be revoked and replaced with a new key held only in `.env`.

### Frontend Configuration (`client/.env`)

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:5000/api/v1` | Base URL for all client Axios API calls |
| `VITE_APP_NAME`| `VorldX Attendance System` | Application display title |

---

## 8. Running the Application

To run both backend and frontend concurrently, open **two separate terminal windows**:

### Terminal 1: Backend Server
```powershell
cd "C:\Users\VorldX Team\OneDrive\Desktop\project atten\server"
npm run dev
```
* The backend server will initialize on **`http://localhost:5000`**
* You should see: `Connected to MongoDB database: vorldx-attendance`

### Terminal 2: Frontend Client
```powershell
cd "C:\Users\VorldX Team\OneDrive\Desktop\project atten\client"
npm run dev
```
* Vite will launch the development server on **`http://localhost:5173`**
* Open your browser and navigate to **`http://localhost:5173`**

---

## 9. Seeding Demo Data

The backend includes a comprehensive database seeder that provisions work shifts, administrative users, active hybrid/remote employees, unactivated demo accounts, active attendance policies, kiosk terminals, 10 working days of attendance records, and audit logs.

### Safe, Idempotent Seeding (Recommended)
This command performs safe upserts. It does not delete existing data and can be executed repeatedly without generating duplicate keys:
```powershell
cd "C:\Users\VorldX Team\OneDrive\Desktop\project atten\server"
npm run seed
```

### Destructive Database Reset
To wipe the database completely and re-seed from scratch:
```powershell
cd "C:\Users\VorldX Team\OneDrive\Desktop\project atten\server"
npm run seed:reset
```

---

## 10. Demo Login Credentials

The following pre-configured user accounts are created during the seed process:

| Role | Employee ID | Name | Password | Account Status & Notes |
| :--- | :--- | :--- | :--- | :--- |
| **HR Admin** | `ADMIN001` | Arjun Sharma | `Admin@123` | Active, Activated — Full HR Admin privileges |
| **Employee** | `EMP001` | Priya Patel | `Employee@123` | Active, Activated — Hybrid (Morning Shift 09:00–18:00) |
| **Employee** | `EMP002` | Rahul Verma | `Employee@123` | Active, Activated — Hybrid (Flexible Shift 10:00–19:00) |
| **Employee** | `EMP003` | Sneha Krishnan | *[None — Use OTP]*| Active, **Not Activated** — Use for Demo OTP Activation Flow |
| **Employee** | `EMP004` | Vikram Singh | `Employee@123` | Active, Activated — Remote worker (WFH eligible) |
| **Employee** | `EMP005` | Anita Desai | `Employee@123` | **Inactive** (Deactivated) — For testing access rejection |

---

## 11. QR Display Kiosk Setup

To simulate a physical office lobby terminal or tablet:

1. Open your browser and login as HR Admin using **`ADMIN001`** / **`Admin@123`**.
2. Navigate to **QR Displays** from the admin sidebar (`/admin/qr-displays`).
3. You will see the default pre-seeded terminal: **Main Office Lobby QR** (Pairing code: `LOBBY-01`).
4. In **Attendance Policies**, configure the correct office GPS coordinates before enabling on-site attendance. The 50-meter radius is fixed; the GPS accuracy threshold is 20 meters by default.
5. Activate the display with its power control, then open the kiosk URL in the same authenticated browser profile (or sign in as an HR Admin/Super Admin on the kiosk device) and navigate to:
   ```
   http://localhost:5173/office/qr-display?displayId=YOUR_DISPLAY_ID
   ```
6. The kiosk displays a QR that rotates every 30 seconds. Employees open **Mark Attendance** on their own authenticated account and scan the kiosk QR. Deactivate the display from **QR Displays** to stop token issuance.

---

## 12. Demo OTP Activation Flow

To demonstrate the first-time employee onboarding and account activation flow:

1. Ensure the backend has `DEMO_MODE=true` set in `server/.env`.
2. Open the frontend at `http://localhost:5173` and click **"First time here? Activate your account"** (or directly open `http://localhost:5173/verify`).
3. In **Step 1 (Employee Identification)**, enter Employee ID: **`EMP003`** and click **Continue**.
4. The system validates that `EMP003` (Sneha Krishnan) exists, is active, but is not yet activated.
5. In **Step 2 (Demo OTP Verification)**:
   * Because `DEMO_MODE=true`, a **highlighted yellow alert box** appears directly on screen showing the 6-digit Demo OTP (e.g., `[DEMO MODE] Your temporary activation code is: 549120`).
   * Enter the 6-digit OTP into the input field and click **Verify Code**.
6. In **Step 3 (Password Setup)**:
   * Create a new secure password (minimum 8 characters, containing uppercase, lowercase, numbers, and symbols).
   * Confirm the password and submit.
7. The account is activated instantly, and the user is redirected to the Employee Dashboard with an active session.

---

## 13. API Overview

The backend REST API is hosted under the `/api/v1` namespace:

| Module Route Group | Base Endpoint | Primary Capabilities |
| :--- | :--- | :--- |
| **Health Check** | `/api/v1/health` | Service uptime, timestamp, environment, and version verification |
| **Authentication** | `/api/v1/auth` | OTP challenge initiation, OTP verification, password activation, login, logout, me profile |
| **Employees** | `/api/v1/employees` | HR directory management, employee onboarding, record updates, status toggles |
| **Attendance** | `/api/v1/attendance` | Today status, history, QR scan check-in/out, summary stats, admin corrections |
| **QR Displays** | `/api/v1/qr-displays`| Device pairing, display status toggles, kiosk token issuance polling |
| **WFH Requests** | `/api/v1/wfh` | Eligibility checker, employee WFH submission, my requests, HR approval/rejection |
| **Policies** | `/api/v1/policies` | Active policy retrieval, company work-rule & shift adjustments |
| **Dashboard** | `/api/v1/dashboard` | High-level metrics, department counts, 7-day trend analysis, recent scans |
| **Reports** | `/api/v1/reports` | Multi-filter attendance queries, statistical totals, CSV export file generation |
| **Audit Logs** | `/api/v1/audit-logs` | Comprehensive security and administrative action audit trails |

*Detailed specifications, parameters, and JSON payloads can be found in [docs/API_DOCUMENTATION.md](file:///C:/Users/VorldX%20Team/OneDrive/Desktop/project%20atten/docs/API_DOCUMENTATION.md).*

---

## 14. Troubleshooting

### Issue 1: MongoDB Connection Error (`MongooseServerSelectionError`)
* **Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:27017`
* **Resolution:** Ensure the MongoDB server is running. On Windows, execute `net start MongoDB` or verify the service status in `services.msc`. If using MongoDB Atlas, check your network connection and verify your current IP is whitelisted in MongoDB Atlas Security settings.

### Issue 2: Port 5000 Already in Use (`EADDRINUSE`)
* **Symptom:** `Error: listen EADDRINUSE: address already in use :::5000`
* **Resolution:** Another background node process is utilizing port 5000. Either terminate the existing process:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process
  ```
  Or change the port in `server/.env` to `PORT=5001` and update `VITE_API_URL=http://localhost:5001/api/v1` in `client/.env`.

### Issue 3: Cross-Origin Resource Sharing (CORS) Errors
* **Symptom:** Browser console displays `Blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`.
* **Resolution:** Verify that `CLIENT_URL` in `server/.env` matches the exact URL of your Vite frontend (`http://localhost:5173`). Trailing slashes must be omitted.

### Issue 4: JWT Authentication Failures
* **Symptom:** `401 Unauthorized` or `jwt malformed` on all authenticated endpoints.
* **Resolution:** Ensure `JWT_SECRET` is defined in `server/.env`. Clear your browser application cookies/localStorage and log in again to receive a newly signed token.

---

## 15. Limitations and Demo-Only Behavior

This application was engineered as an internship capstone project. While architected with production-grade modularity and security practices, the following constraints apply to the current build:

1. **Simulated OTP Delivery (Demo Mode):** In development mode (`DEMO_MODE=true`), verification codes are returned directly in the REST API payload and rendered in the UI for effortless sandbox evaluation. In a production environment, this flag must be set to `false`, and an external provider (Twilio, SendGrid, or AWS SNS) must be wired into `auth.controller.js`.
2. **GPS Spoofing Limitation:** The server enforces the 50-meter boundary and configured GPS accuracy threshold, but browser/device GPS can be spoofed. GPS alone cannot prove physical presence; stronger assurance requires managed devices or a trusted on-site presence factor.
3. **Selfie Limitation:** Selfies are stored as attendance evidence, but the system does not perform facial identity matching or liveness detection.
4. **Scope Exclusions:** The project specifically focuses on attendance, check-in, WFH, and audit logging. Leave balance tracking (earned leave, casual leave, sick leave) and payroll calculations are outside the current scope.
5. **Local Demonstration Scope:** SSL/TLS certificate handling is disabled by default for local `http://` execution. Production deployment requires HTTPS termination and secure cookie flags.

---

## 16. License

This project is licensed under the **MIT License**. Developed as an internship project for **VORLDX INDUSTRIES PRIVATE LIMITED**. All intellectual property and demonstration assets belong to their respective contributors and VorldX Industries.
#   A t t e n d e c e _ T r a c k i n g _ M a s t e r  
 #   A t t e n d e c e _ T r a c k i n g _ M a s t e r  
 #   A t t e n d e n e c  
 