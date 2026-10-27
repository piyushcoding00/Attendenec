# VorldX Attendance System — Database Design
**Database:** MongoDB (Community Server 6.0+)  
**Object Data Modeling (ODM):** Mongoose 7.6.3  
**Organization:** VORLDX INDUSTRIES PRIVATE LIMITED  

---

## 1. Overview & Architecture

The VorldX Employee Attendance System utilizes **MongoDB** as its primary document-oriented data persistence layer. MongoDB's flexible JSON-like document structure, native indexing engine, compound uniqueness capabilities, and Time-to-Live (TTL) automatic deletion features provide a high-throughput, low-latency foundation for real-time attendance tracking and audit verification.

### 1.1 Key Design Principles
* **Single Source of Truth per Day:** Daily attendance state is anchored by a normalized date document per employee.
* **Separation of Concerns:** Ephemeral access challenges (`VerificationChallenge`, `QRToken`) are decoupled from permanent organizational identity records (`User`) and operational historical ledgers (`AttendanceRecord`, `AuditLog`).
* **Strong Concurrency & Uniqueness:** Critical paths (check-in/check-out and WFH submissions) use compound unique indexes to guarantee idempotency and prevent duplicate records during rapid concurrent requests.
* **Automated Data Lifecycle Management:** TTL indexes automatically clean up expired tokens and verification challenges without requiring external cron jobs or background daemon workers.
* **Immutability of Audit Trails:** The `AuditLog` collection is append-only; update and delete operations are prohibited at the service and controller layer.

---

## 2. Entity-Relationship (ER) Diagram

```
+-------------------------------------------------------------------------------------------------+
|                                    ENTITY RELATIONSHIP DIAGRAM                                  |
+-------------------------------------------------------------------------------------------------+

       +------------------+                    +-----------------------+
       |      Shift       |<-------------------|   AttendancePolicy    |
       +------------------+  (defaultShift)    +-----------------------+
                ^                                          |
                | (assigned shift)                         | (createdBy)
                |                                          v
       +------------------+                    +-----------------------+
       |       User       |------------------->|       AuditLog        |
       +------------------+  (actor/target)    +-----------------------+
         |        |     ^                                  ^
         |        |     | (pairedBy)                       | (logs actions)
         |        |     |                                  |
         |        |   +-----------------------+            |
         |        |   |   OfficeQRDisplay     |------------+
         |        |   +-----------------------+
         |        |     ^               |
         |        |     | (displayId)   | (issues)
         |        |     |               v
         |        |     |     +-----------------------+
         |        |     |     |        QRToken        | (TTL: expiresAt + 60s)
         |        |     |     +-----------------------+
         |        |     |
         |        v     |
         |    +-----------------------+
         |    |   AttendanceRecord    |<-----------------+
         |    +-----------------------+                  |
         |      ^               |                        |
         |      | (submits)     | (links to approved)    |
         v      |               v                        |
       +------------------+   +-----------------------+  |
       | VerificationChall|   |      WFHRequest       |--+
       +------------------+   +-----------------------+
        (TTL: expiresAt+60s)
```

---

## 3. Database Models & Schema Specifications

---

### 3.1 Model: User
Represents all system identities, including HR Administrators, office personnel, hybrid staff, and remote engineers.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `employeeId` | `String` | Yes | — | Unique, uppercase, trimmed (e.g., `ADMIN001`, `EMP001`) |
| `name` | `String` | Yes | — | Full legal name (max 100 characters) |
| `email` | `String` | No | — | Lowercase, trimmed corporate or demo email |
| `password` | `String` | No | `null` | Bcrypt hash (cost: 12). `select: false` (hidden in queries by default) |
| `role` | `String` | Yes | `'employee'`| Enum: `['hr_admin', 'employee']` |
| `department` | `String` | Yes | — | Department name (e.g., `'Engineering'`, `'Human Resources'`) |
| `designation`| `String` | Yes | — | Job title (e.g., `'Software Engineer'`, `'HR Manager'`) |
| `joiningDate`| `Date` | Yes | — | Formal employment commencement date |
| `workType` | `String` | Yes | `'office'` | Enum: `['office', 'remote', 'hybrid']` |
| `shift` | `ObjectId` | No | `null` | Reference to `Shift` model |
| `wfhEligible`| `Boolean`| No | `false` | Entitlement flag for submitting WFH requests |
| `isActive` | `Boolean`| No | `true` | System access active flag (kill-switch) |
| `isAccountActivated` | `Boolean` | No | `false` | Completed first-time OTP verification & password setup |
| `isDemoAccount` | `Boolean` | No | `true` | Sandbox/demo classification flag |
| `createdAt` | `Date` | Auto | Now | Timestamp of record creation |
| `updatedAt` | `Date` | Auto | Now | Timestamp of last modification |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ employeeId: 1 }` | Single (Unique) | O(1) lookup during authentication and profile fetch |
| `{ department: 1 }` | Single | Fast filtering for department-level analytics |
| `{ isActive: 1 }` | Single | Query optimization for active employee counts |
| `{ role: 1 }` | Single | Role-based authorization queries |

#### Relationships & Constraints
* `shift`: `ObjectId` referencing the `Shift` collection.
* **Pre-save Hook:** Intercepts password modifications and computes a 12-round bcrypt hash before storing.
* **Methods:** `correctPassword(candidate)` for constant-time comparison; `toJSON()` strips the password field from serializations.

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7a81",
  "employeeId": "EMP001",
  "name": "Priya Patel",
  "email": "priya.patel@vorldx.demo",
  "role": "employee",
  "department": "Engineering",
  "designation": "Software Engineer",
  "joiningDate": "2024-03-01T00:00:00.000Z",
  "workType": "hybrid",
  "shift": "670c5e7b1a2b3c4d5e6f7a70",
  "wfhEligible": true,
  "isActive": true,
  "isAccountActivated": true,
  "isDemoAccount": true,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

---

### 3.2 Model: Shift
Defines working hour rules, expected arrival/departure boundaries, and grace periods.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `name` | `String` | Yes | — | Shift name (e.g., `'Morning Shift'`, `'Flexible Shift'`) |
| `startTime` | `String` | Yes | — | Start time in `HH:mm` format (matches `/^([01]\d\|2[0-3]):([0-5]\d)$/`) |
| `endTime` | `String` | Yes | — | End time in `HH:mm` format (e.g., `'18:00'`) |
| `graceMinutes`| `Number` | No | `15` | Minutes past `startTime` before check-in is penalized as late |
| `workingDays` | `[String]` | No | Mon–Fri | Array of days: `['monday', 'tuesday', 'wednesday', 'thursday', 'friday']` |
| `isDefault` | `Boolean` | No | `false` | Default shift assigned when employee has no specific assignment |
| `isActive` | `Boolean` | No | `true` | Soft-deletion flag |
| `createdAt` | `Date` | Auto | Now | Record creation timestamp |
| `updatedAt` | `Date` | Auto | Now | Record update timestamp |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ isDefault: 1 }` | Single | Rapid lookup for company fallback shift |
| `{ isActive: 1 }` | Single | Query optimization for active shifts |

#### Relationships & Constraints
* Referenced by `User.shift` and `AttendancePolicy.defaultShift`.

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7a70",
  "name": "Morning Shift",
  "startTime": "09:00",
  "endTime": "18:00",
  "graceMinutes": 15,
  "workingDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "isDefault": true,
  "isActive": true,
  "createdAt": "2026-10-14T06:00:00.000Z",
  "updatedAt": "2026-10-14T06:00:00.000Z"
}
```

---

### 3.3 Model: AttendancePolicy
Singleton document holding global organizational attendance and kiosk operational rules.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `companyTimezone` | `String` | No | `'Asia/Kolkata'`| Reference timezone for start-of-day UTC calculations |
| `defaultShift` | `ObjectId`| No | `null` | Reference to `Shift` model |
| `qrTokenExpiresSeconds` | `Number` | No | `30` | Lifespan in seconds for dynamic kiosk QR codes (min: 5) |
| `qrRefreshIntervalSeconds`| `Number` | No | `30` | Auto-refresh polling frequency on kiosk displays |
| `wfhEnabled` | `Boolean`| No | `true` | Master switch for Work From Home functionality |
| `wfhMaxDaysPerMonth` | `Number` | No | `8` | Maximum allowable approved WFH days per employee per month |
| `wfhRequiresApproval` | `Boolean`| No | `true` | If true, requests require explicit HR admin approval |
| `wfhAdvanceNoticeDays` | `Number` | No | `1` | Required advance days before requested WFH date |
| `wfhEligibleWorkTypes` | `[String]`| No | `['remote', 'hybrid']` | Allowed work models for WFH submissions |
| `attendanceCutoffHour` | `Number` | No | `23` | Hour past which open sessions are considered incomplete (0-23) |
| `halfDayDurationMinutes`| `Number` | No | `240` | Minimum minutes to count as half-day presence (4 hours) |
| `fullDayDurationMinutes`| `Number` | No | `480` | Standard full-day expected working duration (8 hours) |
| `isActive` | `Boolean`| No | `true` | Active status of this policy configuration |
| `effectiveDate` | `Date` | No | Date.now | Timestamp when policy became active |
| `createdBy` | `ObjectId`| No | `null` | Reference to `User` (HR Admin who established policy) |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ isActive: 1, effectiveDate: -1 }` | Compound | Fetch currently active policy via `AttendancePolicy.getCurrent()` |

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7e01",
  "companyTimezone": "Asia/Kolkata",
  "defaultShift": "670c5e7b1a2b3c4d5e6f7a70",
  "qrTokenExpiresSeconds": 30,
  "qrRefreshIntervalSeconds": 30,
  "wfhEnabled": true,
  "wfhMaxDaysPerMonth": 8,
  "wfhRequiresApproval": true,
  "wfhAdvanceNoticeDays": 1,
  "wfhEligibleWorkTypes": ["remote", "hybrid"],
  "attendanceCutoffHour": 23,
  "halfDayDurationMinutes": 240,
  "fullDayDurationMinutes": 480,
  "isActive": true,
  "effectiveDate": "2024-01-01T00:00:00.000Z",
  "createdBy": "670c5e7b1a2b3c4d5e6f7a80"
}
```

---

### 3.4 Model: AttendanceRecord
Primary record representing an employee's attendance session for a specific business date.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `employee` | `ObjectId` | Yes | — | Reference to `User` |
| `date` | `Date` | Yes | — | Normalized UTC date representing start of day (00:00:00 IST) |
| `checkIn` | `Date` | No | `null` | Exact timestamp of initial check-in scan |
| `checkOut` | `Date` | No | `null` | Exact timestamp of departure check-out scan |
| `status` | `String` | Yes | `'incomplete'`| Enum: `['present', 'late', 'wfh', 'incomplete', 'not_checked_in']` |
| `method` | `String` | Yes | `'qr_scan'` | Enum: `['qr_scan', 'manual', 'wfh', 'correction']` |
| `workingMinutes` | `Number` | No | `0` | Calculated duration between `checkIn` and `checkOut` in minutes |
| `isLate` | `Boolean` | No | `false` | Late flag evaluated against shift grace period |
| `lateByMinutes` | `Number` | No | `0` | Number of minutes arrived after grace cutoff |
| `linkedWFHRequest`| `ObjectId`| No | `null` | Reference to `WFHRequest` if status is `'wfh'` |
| `qrDisplayId` | `ObjectId` | No | `null` | Reference to `OfficeQRDisplay` where QR scan took place |
| `correction` | `Object` | No | `{}` | Embedded subdocument containing audit details of manual HR overrides |
| `correction.correctedBy` | `ObjectId` | No | `null` | Reference to `User` (Admin) |
| `correction.correctedAt` | `Date` | No | `null` | Timestamp of correction |
| `correction.reason` | `String` | No | — | Required justification (minimum 10 characters) |
| `correction.previousValues`| `Mixed` | No | `{}` | Snapshot of checkIn, checkOut, status, and duration before edit |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ employee: 1, date: 1 }` | **Compound Unique** | **Guarantees strictly 1 attendance session per employee per day** |
| `{ date: 1 }` | Single | Multi-employee daily reports and dashboard aggregations |
| `{ status: 1 }` | Single | Query optimization for present/late/wfh metrics |
| `{ employee: 1, date: -1 }` | Compound | Fast reverse-chronological personal attendance history queries |

#### Pre-save Logic
Calculates `workingMinutes = (checkOut - checkIn) in minutes` automatically when both timestamps exist, except when `method === 'correction'` to preserve manual administrative entries.

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7b01",
  "employee": "670c5e7b1a2b3c4d5e6f7a81",
  "date": "2026-10-14T00:00:00.000Z",
  "checkIn": "2026-10-14T03:35:12.000Z",
  "checkOut": "2026-10-14T12:35:12.000Z",
  "status": "present",
  "method": "qr_scan",
  "workingMinutes": 540,
  "isLate": false,
  "lateByMinutes": 0,
  "qrDisplayId": "670c5e7b1a2b3c4d5e6f7c01",
  "createdAt": "2026-10-14T03:35:12.000Z",
  "updatedAt": "2026-10-14T12:35:12.000Z"
}
```

---

### 3.5 Model: WFHRequest
Manages remote work requests, business reasons, and administrative approval states.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `employee` | `ObjectId` | Yes | — | Reference to `User` |
| `requestedDate` | `Date` | Yes | — | Target remote work date (start of day UTC) |
| `reason` | `String` | Yes | — | Employee justification (max 500 characters) |
| `status` | `String` | Yes | `'pending'` | Enum: `['pending', 'approved', 'rejected']` |
| `reviewer` | `ObjectId` | No | `null` | Reference to `User` (HR Admin who made decision) |
| `reviewedAt` | `Date` | No | `null` | Timestamp when request was reviewed |
| `reviewComment` | `String` | No | `null` | Administrative review rationale or rejection reason |
| `attendanceRecord`| `ObjectId`| No | `null` | Reference to created `AttendanceRecord` if approved |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ employee: 1, requestedDate: 1 }` | **Compound Unique** | **Prevents multiple WFH applications for the same date** |
| `{ status: 1 }` | Single | Fast retrieval of pending queue in HR dashboard |
| `{ requestedDate: 1 }` | Single | Querying requests within monthly billing/reporting intervals |

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7d01",
  "employee": "670c5e7b1a2b3c4d5e6f7a81",
  "requestedDate": "2026-10-20T00:00:00.000Z",
  "reason": "Home broadband fiber maintenance",
  "status": "approved",
  "reviewer": "670c5e7b1a2b3c4d5e6f7a80",
  "reviewedAt": "2026-10-14T07:30:00.000Z",
  "reviewComment": "Approved for sprint feature delivery",
  "attendanceRecord": "670c5e7b1a2b3c4d5e6f7b99",
  "createdAt": "2026-10-14T07:15:00.000Z",
  "updatedAt": "2026-10-14T07:30:00.000Z"
}
```

---

### 3.6 Model: OfficeQRDisplay
Tracks physical office lobby kiosks, pairing credentials, and device heartbeats.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `displayName` | `String` | Yes | — | Terminal identifier (e.g., `'Main Office Lobby QR'`) |
| `pairingCode` | `String` | No | — | Unique, uppercase human-readable pairing identifier |
| `isActive` | `Boolean` | No | `true` | Allows HR admin to disable an unmonitored terminal |
| `isPaired` | `Boolean` | No | `false` | True once pairing handshake is completed |
| `pairedAt` | `Date` | No | `null` | Timestamp when device pairing occurred |
| `pairedBy` | `ObjectId` | No | `null` | Reference to `User` (Admin) |
| `lastTokenIssuedAt`| `Date` | No | `null` | Heartbeat timestamp of last token refresh query |
| `lastScanAt` | `Date` | No | `null` | Timestamp of most recent employee scan at this terminal |
| `location` | `String` | No | — | Physical office location (e.g., `'Ground Floor Reception'`) |
| `notes` | `String` | No | — | Hardware specs or placement notes |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ pairingCode: 1 }` | Single (Unique, Sparse)| Quick lookup during kiosk registration |
| `{ isActive: 1 }` | Single | Querying available and operational terminals |
| `{ isPaired: 1 }` | Single | Filtering paired devices |

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7c01",
  "displayName": "Main Office Lobby QR",
  "pairingCode": "LOBBY-01",
  "isActive": true,
  "isPaired": true,
  "pairedAt": "2024-01-20T00:00:00.000Z",
  "pairedBy": "670c5e7b1a2b3c4d5e6f7a80",
  "lastTokenIssuedAt": "2026-10-14T07:15:00.000Z",
  "lastScanAt": "2026-10-14T03:35:12.000Z",
  "location": "Ground Floor Reception",
  "notes": "Primary entrance tablet terminal"
}
```

---

### 3.7 Model: QRToken
Ephemeral cryptographic token generated for kiosk display and scan verification.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `tokenHash` | `String` | Yes | — | SHA-256 hash of the 32-byte raw cryptographic random token |
| `display` | `ObjectId` | Yes | — | Reference to `OfficeQRDisplay` terminal |
| `expiresAt` | `Date` | Yes | — | Exact expiration timestamp (now + 30s) |
| `isUsed` | `Boolean` | No | `false` | Consumed flag. Set to `true` upon first valid scan |
| `usedAt` | `Date` | No | `null` | Timestamp when token was consumed |
| `usedBy` | `ObjectId` | No | `null` | Reference to `User` who scanned this token |
| `attendanceType` | `String` | No | `'auto'` | Enum: `['check_in', 'check_out', 'auto']` |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ tokenHash: 1 }` | Single (Unique) | Rapid O(1) hash verification |
| `{ display: 1 }` | Single | Token invalidation per display |
| `{ expiresAt: 1 }` | **TTL Index** | **`expireAfterSeconds: 60` — Auto-purges expired tokens** |

#### Static Helper Methods
* `createToken(displayId, expiresSeconds)`: Generates 32-byte crypto random token, computes SHA-256 hash, and inserts document.
* `verifyToken(rawToken)`: Hashes candidate raw token and checks for unconsumed (`isUsed: false`) and non-expired (`expiresAt > now`) record.

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7e99",
  "tokenHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "display": "670c5e7b1a2b3c4d5e6f7c01",
  "expiresAt": "2026-10-14T07:15:30.000Z",
  "isUsed": false,
  "attendanceType": "auto",
  "createdAt": "2026-10-14T07:15:00.000Z"
}
```

---

### 3.8 Model: AuditLog
Append-only historical ledger capturing all security, administrative, and attendance actions.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `actor` | `ObjectId` | No | `null` | Reference to `User` performing the action |
| `actorEmployeeId` | `String` | No | — | Denormalized actor employee ID for quick reporting |
| `action` | `String` | Yes | — | Enum of 23 auditable actions (e.g., `LOGIN`, `ATTENDANCE_CHECK_IN`, `POLICY_UPDATED`) |
| `targetType` | `String` | No | — | Target entity name (`'User'`, `'AttendanceRecord'`, `'AttendancePolicy'`) |
| `targetId` | `ObjectId` | No | `null` | Target document `_id` |
| `targetEmployeeId`| `String` | No | — | Target employee ID (e.g., employee whose record was modified) |
| `metadata` | `Mixed` | No | `{}` | JSON diff object containing old and new values, reasons, or failure notes |
| `ipAddress` | `String` | No | — | Client IPv4 / IPv6 address |
| `userAgent` | `String` | No | — | Client browser User-Agent header |
| `createdAt` | `Date` | Auto | Now | Immutable timestamp of event |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ actor: 1 }` | Single | Querying all actions performed by a specific admin/user |
| `{ action: 1 }` | Single | Filtering by specific event types (e.g., failed logins) |
| `{ createdAt: -1 }` | Single | Chronological ordering for administrative audit log viewer |
| `{ targetId: 1 }` | Single | Tracking complete lifecycle history of a specific entity |

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7f01",
  "actor": "670c5e7b1a2b3c4d5e6f7a80",
  "actorEmployeeId": "ADMIN001",
  "action": "ATTENDANCE_CORRECTED",
  "targetType": "AttendanceRecord",
  "targetId": "670c5e7b1a2b3c4d5e6f7b01",
  "targetEmployeeId": "EMP001",
  "metadata": {
    "reason": "Employee forgot to scan out due to emergency network outage",
    "previousValues": { "checkOut": null, "workingMinutes": 0, "status": "incomplete" },
    "newValues": { "checkOut": "2026-10-14T12:35:12.000Z", "workingMinutes": 540, "status": "present" }
  },
  "ipAddress": "127.0.0.1",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "createdAt": "2026-10-14T07:45:00.000Z"
}
```

---

### 3.9 Model: VerificationChallenge
Stores temporary 6-digit OTP challenges for first-time account activation.

#### Field Specifications
| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto | Generated | MongoDB Primary Key |
| `employeeId` | `String` | Yes | — | Target uppercase Employee ID |
| `employee` | `ObjectId` | No | `null` | Reference to `User` |
| `otpHash` | `String` | Yes | — | Bcrypt hash of the 6-digit verification code |
| `expiresAt` | `Date` | Yes | — | Expiration timestamp (valid for 5 minutes) |
| `isUsed` | `Boolean` | No | `false` | Flag indicating challenge has been consumed |
| `usedAt` | `Date` | No | `null` | Timestamp of challenge consumption |
| `attempts` | `Number` | No | `0` | Number of incorrect verification attempts entered |
| `maxAttempts` | `Number` | No | `3` | Maximum allowed failed attempts before challenge lock |

#### Indexes
| Fields | Type | Purpose |
| :--- | :--- | :--- |
| `{ employeeId: 1 }` | Single | Rapid lookup for pending activation challenges |
| `{ expiresAt: 1 }` | **TTL Index** | **`expireAfterSeconds: 60` — Auto-purges challenges after expiry** |

#### Example Document (JSON)
```json
{
  "_id": "670c5e7b1a2b3c4d5e6f7d55",
  "employeeId": "EMP003",
  "employee": "670c5e7b1a2b3c4d5e6f7a8b",
  "otpHash": "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890",
  "expiresAt": "2026-10-14T07:20:30.000Z",
  "isUsed": false,
  "attempts": 0,
  "maxAttempts": 3,
  "createdAt": "2026-10-14T07:15:30.000Z"
}
```

---

## 4. Key Design Decisions

### 4.1 Compound Unique Indexes for Data Integrity
Race conditions and double-clicking on mobile devices can easily spawn duplicate database entries in high-frequency web applications. The schema mitigates this via two critical compound unique indexes:
1. `AttendanceRecord: { employee: 1, date: 1 }`: Guarantees that an employee cannot have more than one attendance session per calendar working day. Scans are handled via atomic `$setOnInsert` and `$set` updates.
2. `WFHRequest: { employee: 1, requestedDate: 1 }`: Prevents duplicate pending or approved remote work applications for the same date.

### 4.2 Automated Document Cleanup via TTL Indexes
Instead of accumulating hundreds of thousands of expired dynamic QR tokens and verification challenges, MongoDB's background Time-To-Live thread automatically monitors and deletes expired records:
* `QRToken`: Purged 60 seconds after `expiresAt`.
* `VerificationChallenge`: Purged 60 seconds after `expiresAt`.
This keeps memory working sets compact and index tree depths minimal without administrative intervention.

### 4.3 Timezone Anchoring
Because check-ins can occur across shift boundaries, the application anchors all daily records using start-of-day UTC timestamps (`00:00:00.000 IST`). This ensures that an employee checking in at 09:05 AM IST and checking out at 06:15 PM IST are bound to the exact same calendar document, avoiding date-splitting bugs caused by UTC date rollovers.
