# VorldX Attendance System — API Documentation
**Organization:** VORLDX INDUSTRIES PRIVATE LIMITED  
**Base URL:** `http://localhost:5000/api/v1`  
**Authentication:** Bearer token in `Authorization` header (`Authorization: Bearer <token>`) OR via `httpOnly` cookie named `token`.  
**Content-Type:** `application/json` (unless specified otherwise for CSV exports)  

---

## Standard Response Structures

### Success Envelope
All JSON responses return a standardized wrapper:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Paginated Success Envelope
Endpoints returning paginated lists return a `pagination` metadata object:
```json
{
  "success": true,
  "message": "Records retrieved successfully",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Envelope
When an error occurs, the server responds with:
```json
{
  "success": false,
  "message": "Detailed error message",
  "errors": [ ... ] // Optional field containing validation issues
}
```

---

## HTTP Status Codes

The API utilizes standard HTTP response status codes:

| Code | Status | Meaning |
| :--- | :--- | :--- |
| **200** | `OK` | Request succeeded; payload returned. |
| **201** | `Created` | Resource successfully created. |
| **400** | `Bad Request` | Malformed request or business logic validation failure. |
| **401** | `Unauthorized` | Missing or invalid authentication token. |
| **403** | `Forbidden` | Authenticated user lacks permission for this role. |
| **404** | `Not Found` | Requested resource does not exist. |
| **422** | `Unprocessable Entity` | Schema validation error (e.g., missing required fields, regex mismatch). |
| **429** | `Too Many Requests` | Rate limit threshold exceeded. |
| **500** | `Internal Server Error`| Unhandled server exception. |

---

## 1. Health Check

### GET `/health`
Check backend server status, runtime environment, timestamp, and API version.

* **Authentication:** None (Public)
* **Query Parameters:** None
* **Request Body:** None
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "VorldX Attendance API is running",
  "timestamp": "2026-10-14T07:15:30.123Z",
  "environment": "development",
  "version": "1.0.0"
}
```

---

## 2. Authentication

### POST `/auth/start-verification`
Initiate first-time employee onboarding and generate a temporary 6-digit verification challenge. In `DEMO_MODE=true`, the temporary OTP is returned in the response payload.

* **Authentication:** None (Public)
* **Rate Limit:** 10 requests / 15 minutes
* **Request Body:**
```json
{
  "employeeId": "EMP003"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification code generated (Demo Mode: demoOTP included)",
  "data": {
    "employeeId": "EMP003",
    "name": "Sneha Krishnan",
    "department": "Marketing",
    "designation": "Marketing Executive",
    "expiresInMinutes": 5,
    "expiresAt": "2026-10-14T07:20:30.123Z",
    "demoOTP": "489201"
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Account is already activated.
  * **403 Forbidden:** Account is deactivated by HR.
  * **404 Not Found:** Employee ID not found in system.

---

### POST `/auth/verify-demo-otp`
Verify the entered 6-digit OTP code against the active challenge without consuming it (allows user to proceed to password setup).

* **Authentication:** None (Public)
* **Rate Limit:** 10 requests / 15 minutes
* **Request Body:**
```json
{
  "employeeId": "EMP003",
  "otp": "489201"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification code confirmed. You may proceed to create your password.",
  "data": {
    "employeeId": "EMP003",
    "verified": true
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Invalid OTP, expired OTP, or maximum verification attempts exceeded.

---

### POST `/auth/activate-account`
Set the permanent account password, mark the employee account as activated, consume the challenge, and issue a session JWT.

* **Authentication:** None (Public)
* **Rate Limit:** 10 requests / 15 minutes
* **Request Body:**
```json
{
  "employeeId": "EMP003",
  "otp": "489201",
  "password": "Password@123"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Account activated successfully. Welcome to VorldX!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "user": {
      "_id": "670c5e7b1a2b3c4d5e6f7a8b",
      "employeeId": "EMP003",
      "name": "Sneha Krishnan",
      "role": "employee",
      "department": "Marketing",
      "designation": "Marketing Executive",
      "workType": "office",
      "isActive": true,
      "isAccountActivated": true
    }
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Password does not meet complexity requirements or OTP code is invalid.
  * **404 Not Found:** Employee not found.

---

### POST `/auth/login`
Authenticate employee or HR administrator with Employee ID and password.

* **Authentication:** None (Public)
* **Rate Limit:** 5 requests / 15 minutes
* **Request Body:**
```json
{
  "employeeId": "ADMIN001",
  "password": "Admin@123"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "user": {
      "_id": "670c5e7b1a2b3c4d5e6f7a80",
      "employeeId": "ADMIN001",
      "name": "Arjun Sharma",
      "role": "hr_admin",
      "department": "Human Resources",
      "designation": "HR Manager",
      "workType": "office",
      "isActive": true,
      "isAccountActivated": true
    }
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Account is not yet activated.
  * **401 Unauthorized:** Invalid Employee ID or password.
  * **403 Forbidden:** Account has been deactivated.

---

### POST `/auth/logout`
Sign out user and clear `token` HTTP cookie.

* **Authentication:** Required (`hr_admin` or `employee`)
* **Request Body:** None
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

---

### GET `/auth/me`
Retrieve profile of currently authenticated user.

* **Authentication:** Required (`hr_admin` or `employee`)
* **Request Body:** None
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Current user profile retrieved successfully",
  "data": {
    "user": {
      "_id": "670c5e7b1a2b3c4d5e6f7a81",
      "employeeId": "EMP001",
      "name": "Priya Patel",
      "role": "employee",
      "department": "Engineering",
      "designation": "Software Engineer",
      "workType": "hybrid",
      "wfhEligible": true,
      "shift": {
        "_id": "670c5e7b1a2b3c4d5e6f7a70",
        "name": "Morning Shift",
        "startTime": "09:00",
        "endTime": "18:00",
        "graceMinutes": 15
      }
    }
  }
}
```

---

## 3. Employees Management

### GET `/employees`
List all employees with pagination, search, and department filtering.

* **Authentication:** Required (`hr_admin` only)
* **Query Parameters:**
  * `page` (integer, optional, default: 1)
  * `limit` (integer, optional, default: 20)
  * `search` (string, optional, matches name or employee ID)
  * `department` (string, optional)
  * `workType` (string, optional: `office`, `hybrid`, `remote`)
  * `isActive` (boolean, optional)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Employees retrieved successfully",
  "data": [
    {
      "_id": "670c5e7b1a2b3c4d5e6f7a81",
      "employeeId": "EMP001",
      "name": "Priya Patel",
      "role": "employee",
      "department": "Engineering",
      "designation": "Software Engineer",
      "workType": "hybrid",
      "isActive": true,
      "isAccountActivated": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### POST `/employees`
Register a new employee into the system.

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "employeeId": "EMP006",
  "name": "Karan Mehra",
  "email": "karan.mehra@vorldx.demo",
  "department": "Engineering",
  "designation": "Junior Backend Developer",
  "joiningDate": "2026-10-15",
  "workType": "hybrid",
  "wfhEligible": true,
  "role": "employee"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Employee created successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7a90",
    "employeeId": "EMP006",
    "name": "Karan Mehra",
    "role": "employee",
    "department": "Engineering",
    "designation": "Junior Backend Developer",
    "workType": "hybrid",
    "isActive": true,
    "isAccountActivated": false
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Duplicate Employee ID.
  * **422 Unprocessable Entity:** Validation errors on missing fields.

---

### GET `/employees/:id`
Retrieve detailed profile of a single employee by Mongo ID.

* **Authentication:** Required (`hr_admin` only)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Employee retrieved successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7a81",
    "employeeId": "EMP001",
    "name": "Priya Patel",
    "role": "employee",
    "department": "Engineering",
    "designation": "Software Engineer",
    "workType": "hybrid",
    "joiningDate": "2024-03-01T00:00:00.000Z",
    "isActive": true,
    "isAccountActivated": true
  }
}
```

---

### PATCH `/employees/:id`
Update an employee's details (department, designation, workType, shift, etc.).

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "designation": "Lead Software Engineer",
  "workType": "hybrid",
  "wfhEligible": true
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Employee updated successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7a81",
    "employeeId": "EMP001",
    "designation": "Lead Software Engineer"
  }
}
```

---

### PATCH `/employees/:id/status`
Activate or deactivate an employee account.

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "isActive": false
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Employee account deactivated successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7a85",
    "employeeId": "EMP005",
    "isActive": false
  }
}
```

---

## 4. Attendance

### GET `/attendance/today`
Fetch today's attendance record for the authenticated employee.

* **Authentication:** Required (`employee` or `hr_admin`)
* **Request Body:** None
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Today's attendance record retrieved successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7b01",
    "employee": {
      "_id": "670c5e7b1a2b3c4d5e6f7a81",
      "name": "Priya Patel",
      "employeeId": "EMP001"
    },
    "date": "2026-10-14T00:00:00.000Z",
    "checkIn": "2026-10-14T03:35:12.000Z",
    "checkOut": null,
    "status": "present",
    "method": "qr_scan",
    "isLate": false,
    "lateByMinutes": 0,
    "workingMinutes": 0
  }
}
```

---

### GET `/attendance/me`
Retrieve personal attendance history with pagination and date range filters.

* **Authentication:** Required (`employee` or `hr_admin`)
* **Query Parameters:**
  * `startDate` (ISO string, optional, e.g. `2026-10-01`)
  * `endDate` (ISO string, optional, e.g. `2026-10-31`)
  * `page` (integer, default: 1)
  * `limit` (integer, default: 20)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "My attendance history retrieved successfully",
  "data": [
    {
      "_id": "670c5e7b1a2b3c4d5e6f7b01",
      "date": "2026-10-14T00:00:00.000Z",
      "checkIn": "2026-10-14T03:35:12.000Z",
      "checkOut": "2026-10-14T12:35:12.000Z",
      "status": "present",
      "workingMinutes": 540,
      "isLate": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### POST `/attendance/scan-qr`
Process a QR code scan. Determines whether the scan is a **Check-In** or **Check-Out**, validates token hash, verifies against shift hours, and consumes the token.

* **Authentication:** Required (`employee` or `hr_admin`)
* **Rate Limit:** 30 requests / minute
* **Request Body:**
```json
{
  "token": "4a7f28bc39d01e4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"
}
```
* **Success Response - Check-In (200 OK):**
```json
{
  "success": true,
  "message": "Checked in successfully",
  "data": {
    "action": "check_in",
    "record": {
      "_id": "670c5e7b1a2b3c4d5e6f7b01",
      "employee": "670c5e7b1a2b3c4d5e6f7a81",
      "date": "2026-10-14T00:00:00.000Z",
      "checkIn": "2026-10-14T03:35:00.000Z",
      "status": "present",
      "isLate": false,
      "lateByMinutes": 0,
      "method": "qr_scan"
    }
  }
}
```
* **Success Response - Check-Out (200 OK):**
```json
{
  "success": true,
  "message": "Checked out successfully (9h 0m recorded)",
  "data": {
    "action": "check_out",
    "record": {
      "_id": "670c5e7b1a2b3c4d5e6f7b01",
      "employee": "670c5e7b1a2b3c4d5e6f7a81",
      "checkIn": "2026-10-14T03:35:00.000Z",
      "checkOut": "2026-10-14T12:35:00.000Z",
      "status": "present",
      "workingMinutes": 540
    }
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Token expired, token already used, employee has an approved WFH for today, or daily attendance already completed.

---

### GET `/attendance`
Retrieve organization-wide attendance records with multi-factor filters.

* **Authentication:** Required (`hr_admin` only)
* **Query Parameters:**
  * `startDate`, `endDate`, `department`, `status`, `employeeId`, `page`, `limit`
* **Success Response (200 OK):** Returns paginated attendance records across the organization.

---

### GET `/attendance/:id`
Retrieve a specific attendance record by ID.

* **Authentication:** Required (`hr_admin` only)
* **Success Response (200 OK):** Detailed attendance document with populated employee, display, and correction references.

---

### PATCH `/attendance/:id/correction`
Apply an administrative correction to an existing attendance record.

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "checkIn": "2026-10-14T03:30:00.000Z",
  "checkOut": "2026-10-14T12:30:00.000Z",
  "status": "present",
  "reason": "Employee forgot to scan out due to emergency network outage"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Attendance record corrected successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7b01",
    "status": "present",
    "method": "correction",
    "workingMinutes": 540,
    "correction": {
      "correctedBy": "670c5e7b1a2b3c4d5e6f7a80",
      "correctedAt": "2026-10-14T08:00:00.000Z",
      "reason": "Employee forgot to scan out due to emergency network outage"
    }
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Reason missing or under 10 characters.

---

## 5. QR Displays Kiosks

### POST `/qr-displays/pair`
Register and pair a new physical lobby or office entrance kiosk device.

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "displayName": "2nd Floor Entrance Kiosk",
  "location": "Building B - 2nd Floor West Wing",
  "pairingCode": "KIOSK-B2",
  "notes": "Wall-mounted Samsung Galaxy Tab A8"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "message": "QR display paired and registered successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7c01",
    "displayName": "2nd Floor Entrance Kiosk",
    "pairingCode": "KIOSK-B2",
    "location": "Building B - 2nd Floor West Wing",
    "isActive": true,
    "isPaired": true,
    "pairedAt": "2026-10-14T07:00:00.000Z"
  }
}
```

---

### GET `/qr-displays`
List all paired office QR displays with current status and heartbeat metrics.

* **Authentication:** Required (`hr_admin` only)
* **Success Response (200 OK):** Array of all registered `OfficeQRDisplay` documents.

---

### PATCH `/qr-displays/:id/status`
Toggle kiosk display active or inactive state.

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "isActive": false
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "QR display deactivated successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7c01",
    "isActive": false
  }
}
```

---

### POST `/qr-displays/:id/token` (and GET)
Called by the kiosk display screen every 30 seconds to fetch a fresh dynamic QR token. Invalidates prior tokens for this display.

* **Authentication:** None (Device kiosk endpoint; secured via Display ID & active pairing)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "QR token issued successfully",
  "data": {
    "token": "d8e3b2f1a0c495e87a2d1f3b4c5e6a7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b",
    "rawToken": "d8e3b2f1a0c495e87a2d1f3b4c5e6a7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b",
    "expiresAt": "2026-10-14T07:30:30.000Z",
    "expiresIn": 30,
    "displayId": "670c5e7b1a2b3c4d5e6f7c01",
    "displayName": "Main Office Lobby QR",
    "location": "Ground Floor Reception"
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Display is deactivated or not yet paired.
  * **404 Not Found:** Display ID not found.

---

## 6. Work From Home (WFH)

### GET `/wfh/eligibility`
Check whether the authenticated employee is eligible to request WFH for a specified date.

* **Authentication:** Required (`employee` or `hr_admin`)
* **Query Parameters:**
  * `date` (ISO date string, optional, defaults to tomorrow)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Employee is eligible for WFH on this date",
  "data": {
    "eligible": true,
    "reason": null,
    "wfhDaysUsed": 2,
    "wfhMaxDays": 8,
    "wfhRemaining": 6,
    "advanceNoticeDays": 1
  }
}
```

---

### POST `/wfh/requests`
Submit a new Work From Home request.

* **Authentication:** Required (`employee` or `hr_admin`)
* **Request Body:**
```json
{
  "requestedDate": "2026-10-20",
  "reason": "Home broadband maintenance and ISP technician visit"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "message": "WFH request submitted successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7d01",
    "employee": "670c5e7b1a2b3c4d5e6f7a81",
    "requestedDate": "2026-10-20T00:00:00.000Z",
    "reason": "Home broadband maintenance and ISP technician visit",
    "status": "pending",
    "createdAt": "2026-10-14T07:15:00.000Z"
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Ineligible (e.g., workType is `office`, monthly quota exceeded, or insufficient advance notice).
  * **400 Bad Request:** Duplicate request for the same date.

---

### GET `/wfh/requests/me`
Retrieve past and pending WFH requests for the authenticated user.

* **Authentication:** Required (`employee` or `hr_admin`)
* **Query Parameters:**
  * `page` (integer, default: 1), `limit` (integer, default: 20)
* **Success Response (200 OK):** Paginated array of the user's WFH requests.

---

### GET `/wfh/requests`
Retrieve all employee WFH requests across the organization.

* **Authentication:** Required (`hr_admin` only)
* **Query Parameters:**
  * `status` (string, optional: `pending`, `approved`, `rejected`), `page`, `limit`
* **Success Response (200 OK):** Paginated array of all requests with populated employee details.

---

### PATCH `/wfh/requests/:id/decision`
Approve or reject a pending WFH request. Automatically creates or updates the associated `AttendanceRecord` if approved.

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "status": "approved",
  "reviewComment": "Approved. Please ensure availability on Slack during team standup."
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "WFH request approved successfully",
  "data": {
    "_id": "670c5e7b1a2b3c4d5e6f7d01",
    "status": "approved",
    "reviewer": "670c5e7b1a2b3c4d5e6f7a80",
    "reviewedAt": "2026-10-14T07:30:00.000Z",
    "reviewComment": "Approved. Please ensure availability on Slack during team standup."
  }
}
```
* **Error Responses:**
  * **400 Bad Request:** Request is already reviewed, or admin is attempting to self-approve.

---

## 7. Policies

### GET `/policies`
Retrieve active organizational attendance policy parameters and active shift schedules.

* **Authentication:** Required (`employee` or `hr_admin`)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Attendance policies and active shifts retrieved successfully",
  "data": {
    "policy": {
      "_id": "670c5e7b1a2b3c4d5e6f7e01",
      "companyTimezone": "Asia/Kolkata",
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
      "isActive": true
    },
    "shifts": [
      {
        "_id": "670c5e7b1a2b3c4d5e6f7a70",
        "name": "Morning Shift",
        "startTime": "09:00",
        "endTime": "18:00",
        "graceMinutes": 15,
        "isDefault": true
      }
    ]
  }
}
```

---

### PATCH `/policies/:id`
Modify company attendance parameters (or use `:id = current`).

* **Authentication:** Required (`hr_admin` only)
* **Request Body:**
```json
{
  "wfhMaxDaysPerMonth": 10,
  "qrTokenExpiresSeconds": 45,
  "halfDayDurationMinutes": 240
}
```
* **Success Response (200 OK):** Returns updated `AttendancePolicy` document.

---

## 8. Dashboard

### GET `/dashboard/summary`
Retrieve real-time metrics, today attendance distribution, 7-day trends, recent check-ins, and pending WFH requests.

* **Authentication:** Required (`hr_admin` only)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Dashboard summary retrieved successfully",
  "data": {
    "overview": {
      "totalEmployees": 4,
      "presentToday": 3,
      "lateToday": 1,
      "wfhToday": 1,
      "pendingWFH": 1,
      "attendanceRate": 75
    },
    "deptAttendance": [
      { "department": "Engineering", "count": 2 },
      { "department": "Marketing", "count": 1 }
    ],
    "attendanceTrend": [
      {
        "date": "2026-10-14",
        "present": 2,
        "late": 1,
        "wfh": 1,
        "absent": 0,
        "total": 4
      }
    ],
    "recentActivity": [ ... ],
    "recentWFH": [ ... ]
  }
}
```

---

## 9. Reports & CSV Export

### GET `/reports/attendance`
Retrieve filtered attendance records with aggregated summary totals.

* **Authentication:** Required (`hr_admin` only)
* **Query Parameters:**
  * `startDate` (ISO string)
  * `endDate` (ISO string)
  * `department` (string)
  * `status` (string, comma-separated e.g. `present,late`)
  * `employeeId` (string)
  * `page` (integer, default: 1)
  * `limit` (integer, default: 20)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Attendance report retrieved successfully",
  "data": {
    "records": [ ... ],
    "totals": {
      "totalRecords": 30,
      "totalPresent": 22,
      "totalLate": 5,
      "totalWFH": 3,
      "totalIncomplete": 0,
      "attendancePercent": 100.0
    }
  },
  "pagination": { ... }
}
```

---

### GET `/reports/attendance/export`
Stream attendance records formatted as a downloadable CSV spreadsheet.

* **Authentication:** Required (`hr_admin` only)
* **Query Parameters:** Same filters as `/reports/attendance`
* **Response Headers:**
  * `Content-Type: text/csv`
  * `Content-Disposition: attachment; filename="attendance_report_2026-10-14.csv"`
* **Response Body (CSV stream):**
```csv
Employee ID,Name,Department,Date,Check-In,Check-Out,Duration (hrs),Status,Method
EMP001,Priya Patel,Engineering,2026-10-14,2026-10-14 03:35:12,2026-10-14 12:35:12,9.00,present,qr_scan
EMP002,Rahul Verma,Engineering,2026-10-14,2026-10-14 04:45:00,2026-10-14 13:45:00,9.00,late,qr_scan
```

---

## 10. Audit Logs

### GET `/audit-logs`
Query immutable system audit trails with pagination and filtering.

* **Authentication:** Required (`hr_admin` only)
* **Query Parameters:**
  * `action` (string, e.g. `LOGIN`, `ATTENDANCE_CORRECTED`, `POLICY_UPDATED`)
  * `actorEmployeeId` (string)
  * `targetType` (string)
  * `startDate` (ISO string)
  * `endDate` (ISO string)
  * `page` (integer, default: 1)
  * `limit` (integer, default: 20)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": [
    {
      "_id": "670c5e7b1a2b3c4d5e6f7f01",
      "actor": {
        "_id": "670c5e7b1a2b3c4d5e6f7a80",
        "name": "Arjun Sharma",
        "employeeId": "ADMIN001"
      },
      "actorEmployeeId": "ADMIN001",
      "action": "ATTENDANCE_CORRECTED",
      "targetType": "AttendanceRecord",
      "targetId": "670c5e7b1a2b3c4d5e6f7b01",
      "targetEmployeeId": "EMP001",
      "metadata": {
        "reason": "Employee forgot to scan out due to emergency network outage"
      },
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2026-10-14T07:45:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```
