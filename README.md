# Rentora - Boarding House Utility and Rent Management

**GitHub Repository:** https://github.com/jomeljustinebabanto/rentora-ph

Rentora is a web application built for boarding house owners (landlords) and tenants. It manages room records, electric sub-meter computations, water fees, monthly rent invoices, payments, printable statements, and announcements across phones and computers.

---

## Requirements

To run this project, you need:
- **PHP** (version 7.4 or higher, with the `pdo_mysql` extension enabled)
- **MySQL** or **MariaDB** database
- **Web Server** (such as Apache via XAMPP or Laragon for local testing, or InfinityFree for live hosting)
- A modern web browser (Chrome, Edge, Firefox, or Safari)

---

## Features

### 1. Multi-Landlord Support
- **Independent Owner Accounts:** Any boarding house owner can register an account with a custom Boarding House Name, username, and password (8 or more characters).
- **Isolated Data (`landlord_id`):** Rooms, tenants, utility rates, invoices, and announcements are separated by `landlord_id`. Different landlords can use the same room numbers (such as `Room 101`) without affecting each other.
- **Custom Branding:** Each landlord's Boarding House Name appears on the top navigation bar, profile page, SMS reminders, and printed statements.

### 2. Tenant and Room Management
- **Room Registration:** Add rooms with room number, tenant full name (Last, First, Middle), gender (`Male` or `Female`), phone number, monthly base rent, and starting electric sub-meter reading (kWh).
- **Synced Profiles:** Tenant gender details are saved in MySQL so they stay consistent across every computer and phone.
- **Tenant Login Credentials:** Landlords can create or reset a tenant's portal username and password at any time.

### 3. Monthly Utility and Rent Billing
- **Live Bill Calculator:** Computes electricity used (`Current Reading - Previous Reading`), multiplies kWh used by a custom `rate_per_kwh` (up to 4 decimal places), and adds `water_fee` and `base_rent`.
- **Meter Validation:** Prevents saving a bill if the current reading is lower than the previous reading, or if an active (non-void) bill already exists for that room and billing month.
- **Automatic Meter Update:** Generating an invoice updates the room's latest sub-meter reading and saves the landlord's default electricity rate and water fee.

### 4. Payments, Statements, and SMS Reminders
- **Partial and Full Payments:** Record payments with optional payment method notes or reference numbers. Invoices automatically update status between `Unpaid`, `Partial`, and `Paid`.
- **Voiding Bills:** Landlords can void an invoice with a required reason, which reverts the tenant's sub-meter reading back to the previous reading when applicable.
- **Official Statement of Account:** Generates a clean, printable statement (`window.print()`) for any invoice.
- **SMS Reminder Generator:** Creates a ready-to-copy billing summary text message with meter readings, cost breakdown, and remaining balance.

### 5. Announcements Board
- **Targeted Notices:** Landlords can post, edit, and delete notices with priority levels (`normal`, `important`, `urgent`) sent to `ALL` rooms or a specific room.
- **Tenant Filtering:** Tenants only see announcements posted by their own landlord for `ALL` rooms or their assigned room.

### 6. Tenant Self-Service Portal
- Tenants can log in from any phone or computer to view their assigned room details, base rent, latest sub-meter reading, itemized bills, printable statements, and announcements, and can change their own password.

### 7. Display Settings and Data Backup
- **Per-Browser Display Preferences:** Users can adjust text size, spacing, light or dark theme, and helper guide visibility.
- **JSON Backup Export:** Landlords can download a JSON backup of their rooms, invoices, settings, and announcements from the Profile page.

### 8. Security
- Password hashing using PHP `password_hash()` and `password_verify()`.
- Brute-force login protection (locks an account for 15 minutes after 5 failed login attempts).
- HTTP-only `SameSite=Strict` session cookies (`rentora_sid`) and `X-CSRF-TOKEN` verification on all `POST` requests.
- Prepared SQL statements using PHP PDO (`pdo_mysql`).

---

## Project Structure

```text
rentora-ph/
├── index.html          # Main user interface (login screen, landlord and tenant views)
├── script.js           # Frontend logic, live bill calculator, and API requests
├── style.css           # Custom styling
├── tailwind.css        # Tailwind CSS stylesheet
├── config.php          # Database connection settings (create from config.example.php)
├── config.example.php  # Sample database configuration template
├── .gitignore          # Excludes sensitive files like config.php from Git
├── README.md           # Project overview, setup, and run instructions
└── api/
    ├── rentora.php     # Backend JSON API and automatic database schema updater
    └── schema.sql      # Initial MySQL table definitions
```

---

## Database Tables

Rentora uses five MySQL tables:
- `rentora_users` - Stores landlord and tenant accounts, roles, room links, `landlord_id`, `house_name`, and login lock counters.
- `rentora_tenants` - Stores room numbers, tenant names, `gender`, phone numbers, base rent, and current sub-meter readings.
- `rentora_invoices` - Stores generated monthly bills, meter readings, rates, amounts paid, statuses, and void reasons.
- `rentora_announcements` - Stores landlord notices, priorities, and target room filters.
- `rentora_settings` - Stores each landlord's saved `rate_per_kwh` and `water_fee`.

*Note: On startup, `api/rentora.php` runs `ensure_multi_landlord_schema()` to verify and add `landlord_id`, `house_name`, `gender`, and the composite unique index `uq_landlord_room (landlord_id, room_no)` automatically.*

---

## How to Run Locally (Using XAMPP or Laragon)

1. **Clone or Download the Repository**
   ```bash
   git clone [https://github.com/jomeljustinebabanto/rentora-ph.git](https://github.com/jomeljustinebabanto/rentora-ph.git)
   ```
   Move the `rentora-ph` folder into your local web server directory:
   - **XAMPP:** `C:\xampp\htdocs\rentora-ph`
   - **Laragon:** `C:\laragon\www\rentora-ph`

2. **Start Apache and MySQL**
   - Open your XAMPP or Laragon control panel and start both **Apache** and **MySQL**.

3. **Create the Database**
   - Open `http://localhost/phpmyadmin` in your browser.
   - Click **New**, name the database `rentora_db` (or any name you prefer), and click **Create**.
   - Select the new database, open the **Import** tab, select `api/schema.sql`, and click **Go** to create the tables.

4. **Configure `config.php`**
   - Copy `config.example.php` and rename it to `config.php` in the root folder.
   - Open `config.php` and set your local MySQL details:
     ```php
     <?php
     $cfg = [
       'dsn' => 'mysql:host=127.0.0.1;dbname=rentora_db;charset=utf8mb4',
       'user' => 'root',
       'pass' => '',
       'timezone' => 'Asia/Manila'
     ];
     ```

5. **Open the Application**
   - Open `http://localhost/rentora-ph/` in your browser.
   - Click **Create Account** under **Boarding house owner?** to register your landlord account and start adding rooms.

---

## How to Run on Live Hosting (InfinityFree)

1. **Upload Project Files**
   - Log in to your hosting control panel and open **File Manager**.
   - Upload all project files (`index.html`, `script.js`, `style.css`, `tailwind.css`, `README.md`, and the `api/` folder) into your site's `htdocs` folder.

2. **Import the Database**
   - Create a MySQL database in your hosting control panel and open **phpMyAdmin**.
   - Import `api/schema.sql` into your database.

3. **Set Up `config.php`**
   - Create `config.php` inside `htdocs` using your hosting MySQL hostname, database name, username, and password.

4. **Launch the Site**
   - Open your live website URL in a browser, create a landlord account, and sign in.

---

## How to Use Rentora

1. **Register a Landlord Account:** On the login screen, click **Create Account**, enter your Boarding House Name, username, and a password (8 or more characters).
2. **Add Rooms and Tenants:** Open the **Tenants & Rooms** tab and click **+ Add New Tenant**. Enter the room number, tenant name, gender (`Male` or `Female`), phone number, monthly rent, starting meter reading (kWh), and optional tenant login credentials.
3. **Calculate Monthly Bills:** Open the **Monthly Billing & Invoices** tab and click **+ Calculate New Room Bill**. Select a room, enter the electricity rate per kWh, water fee, and current sub-meter reading, then click **Generate Invoice**.
4. **Record Payments and Statements:** Click **Pay** on an invoice to record a partial or full payment, **SMS** to copy a billing reminder text, or **Statement** to print an Official Statement of Account.
5. **Post Announcements:** Open the **Announcements** tab to post notices for all rooms or a specific room.
