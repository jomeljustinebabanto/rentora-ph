# Rentora - Boarding House Utility & Rent Management

Rentora is a web application for boarding house owners (landlords) and tenants. It manages room records, electric sub-meter computations, water shares, monthly rent invoices, payments, printable statements, and announcements across multiple devices.

---

## Features

### 1. Multi-Landlord Support
- **Independent Owner Accounts:** Any boarding house owner can register an account with a custom Boarding House Name, username, and password (8 or more characters).
- **Isolated Data (`landlord_id`):** Rooms, tenants, utility rates, invoices, and announcements are separated by `landlord_id`. Different landlords can use the same room numbers (such as `Room 101`) without affecting each other.
- **Custom Branding:** Each landlord's Boarding House Name appears on the top navigation bar, profile page, SMS reminders, and printed statements.

### 2. Tenant & Room Management
- **Room Registration:** Add rooms with room number, tenant full name (Last, First, Middle), gender (`Male` or `Female`), phone number, monthly base rent, and starting electric sub-meter reading (kWh).
- **Synced Profiles:** Tenant gender badges and avatars are saved in MySQL so they stay consistent on every computer and phone.
- **Tenant Login Credentials:** Landlords can create or reset a tenant's portal username and password at any time.

### 3. Monthly Utility & Rent Billing
- **Live Bill Calculator:** Computes electricity used (`Current Reading - Previous Reading`), multiplies kWh used by a custom `rate_per_kwh` (up to 4 decimal places), and adds `water_fee` and `base_rent`.
- **Meter Validation:** Prevents saving a bill if the current reading is lower than the previous reading, or if an active (non-void) bill already exists for that room and billing month.
- **Automatic Meter Update:** Generating an invoice updates the room's latest sub-meter reading and saves the landlord's default electricity rate and water fee.

### 4. Payments, Statements & SMS Reminders
- **Partial & Full Payments:** Record payments via `GCash`, `Cash`, or `Bank` with optional reference numbers. Invoices automatically update status between `Unpaid`, `Partial`, and `Paid`.
- **Voiding Bills:** Landlords can void an invoice with a required reason, which reverts the tenant's sub-meter reading back to the previous reading when applicable.
- **Official Statement of Account:** Generates a clean, printable statement (`window.print()`) for any invoice.
- **SMS Reminder Generator:** Creates a ready-to-copy billing summary text message with meter readings, cost breakdown, and remaining balance.

### 5. Announcements Board
- **Targeted Notices:** Landlords can post, edit, and delete notices with priority tags (`General Notice`, `Important Reminder`, `Urgent Alert`) sent to `All Rooms` or a specific room.
- **Tenant Filtering:** Tenants only see announcements posted by their own landlord for `All Rooms` or their assigned room.

### 6. Tenant Self-Service Portal
- Tenants log in from any phone or computer to view their assigned room details, base rent, latest sub-meter reading, itemized bills, printable statements, and announcements, and can change their own password.

### 7. Display Settings & Data Backup
- **Per-Browser Display Preferences:** Users can switch between `Standard` and `Large Text`, `Comfortable` and `Compact` spacing, `Light Mode` and `Dark Mode`, and show or hide the interactive bottom-left Helper Guide.
- **JSON Backup Export:** Landlords can download a JSON backup of their rooms, invoices, settings, and announcements from the Profile page.

### 8. Security
- Password hashing using PHP `password_hash()` and `password_verify()`.
- Brute-force login protection (locks an account for 15 minutes after 5 failed login attempts).
- HTTP-only `SameSite=Strict` session cookies (`rentora_sid`) and `X-CSRF-TOKEN` verification on `POST` requests.
- Parameterized SQL queries using PHP PDO (`pdo_mysql`).

---

## Project Structure

```text
/
├── index.html          # Main interface (login screen, landlord/tenant views, modals)
├── script.js           # Frontend state, API calls, live calculator, and UI rendering
├── style.css           # Custom styles
├── tailwind.css        # Compiled Tailwind CSS stylesheet
├── config.php          # Database connection settings ($cfg array)
├── README.md           # Project documentation
└── api/
    ├── rentora.php     # Backend JSON API and automatic schema updater
    └── schema.sql      # Initial MySQL table definitions
