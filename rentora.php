<?php

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
require dirname(__DIR__) . '/config.php';
date_default_timezone_set($cfg['timezone'] ?? 'Asia/Manila');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
ini_set('session.gc_maxlifetime', '28800');
session_name('rentora_sid');
session_set_cookie_params([
  'path' => '/',
  'secure' => !empty($_SERVER['HTTPS']),
  'httponly' => true,
  'samesite' => 'Strict'
]);
session_start();

function out($d = [], $code = 200) {
  http_response_code($code);
  echo json_encode($d + ['success' => $code < 400]);
  exit;
}
function fail($m, $code = 400) { out(['message' => $m], $code); }
function slen($s) { return function_exists('mb_strlen') ? mb_strlen($s) : strlen($s); }
function ssub($s, $n) { return function_exists('mb_substr') ? mb_substr($s, 0, $n) : substr($s, 0, $n); }

try {
  $db = new PDO(
    $cfg['dsn'],
    $cfg['user'] ?? null,
    $cfg['pass'] ?? null,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]
  );
} catch (Throwable $e) {
  error_log($e->getMessage());
  $m = $e->getMessage();
  $hint = [
    1045 => 'wrong database username or password',
    1049 => 'database name not found',
    2002 => 'wrong database host',
    2006 => 'database server went away'
  ][(int)$e->getCode()] ?? 'check config.php';
  if (strpos($m, 'could not find driver') !== false) {
    $hint = 'the PHP MySQL driver pdo_mysql is not enabled';
  }
  fail('The server could not connect to the database (' . $hint . ').', 500);
}

function q($sql, $p = []) {
  global $db;
  $s = $db->prepare($sql);
  $s->execute($p);
  return $s;
}
function num($k, $min = 0, $dec = 2) {
  $v = $_POST[$k] ?? '';
  if (!is_numeric($v) || (float)$v < $min) fail("Invalid number: $k");
  return round((float)$v, $dec);
}
function txt($k, $max = 100) {
  $v = trim((string)($_POST[$k] ?? ''));
  if ($v === '' || slen($v) > $max) fail("Missing or too long: $k");
  return $v;
}
function opt_txt($k, $max = 60) {
  $v = trim((string)($_POST[$k] ?? ''));
  if (slen($v) > $max) fail("Too long: $k");
  return $v;
}
function clean_gender($g) {
  $v = strtolower(trim((string)$g));
  if ($v === 'female' || $v === 'f') return 'Female';
  if ($v === 'male' || $v === 'm') return 'Male';
  fail('Please select Male or Female.');
}
function pass_ok($p) {
  if (strlen($p) < 8) fail('Use a password of 8 or more characters.');
}
function uname($u) {
  $u = strtolower(trim((string)$u));
  if (!preg_match('/^[a-z0-9][a-z0-9._-]{2,29}$/', $u)) {
    fail('Username: 3 to 30 letters, numbers, dot, dash or underscore.');
  }
  return $u;
}
function format_full_name($last, $first, $middle = '') {
  $last = trim((string)$last);
  $first = trim((string)$first);
  $middle = trim((string)$middle);
  if ($last === '' && $first === '') return '';
  $base = $last . ', ' . $first;
  return $middle !== '' ? $base . ' ' . $middle : $base;
}

function table_has_col($table, $col) {
  if (!preg_match('/^[a-zA-Z0-9_]+$/', $table) || !preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
    return false;
  }
  try {
    return (bool)q("SHOW COLUMNS FROM `$table` LIKE ?", [$col])->fetch();
  } catch (Throwable $e) {
    return false;
  }
}

function ensure_multi_landlord_schema() {
  static $done = false;
  if ($done) return;
  $done = true;

  try {
    if (!table_has_col('rentora_users', 'landlord_id')) {
      q("ALTER TABLE rentora_users ADD COLUMN landlord_id INT NOT NULL DEFAULT 0 AFTER room");
    }
    if (!table_has_col('rentora_users', 'house_name')) {
      q("ALTER TABLE rentora_users ADD COLUMN house_name VARCHAR(120) NOT NULL DEFAULT '' AFTER landlord_id");
    }
    if (!table_has_col('rentora_tenants', 'landlord_id')) {
      q("ALTER TABLE rentora_tenants ADD COLUMN landlord_id INT NOT NULL DEFAULT 0 AFTER id");
    }
    if (!table_has_col('rentora_tenants', 'gender')) {
      q("ALTER TABLE rentora_tenants ADD COLUMN gender VARCHAR(10) NOT NULL DEFAULT 'Male' AFTER middle_name");
    }
    if (!table_has_col('rentora_invoices', 'landlord_id')) {
      q("ALTER TABLE rentora_invoices ADD COLUMN landlord_id INT NOT NULL DEFAULT 0 AFTER id");
    }
    if (!table_has_col('rentora_announcements', 'landlord_id')) {
      q("ALTER TABLE rentora_announcements ADD COLUMN landlord_id INT NOT NULL DEFAULT 0 AFTER id");
    }
    if (!table_has_col('rentora_settings', 'landlord_id')) {
      q("ALTER TABLE rentora_settings ADD COLUMN landlord_id INT NOT NULL DEFAULT 0 AFTER id");
    }

    // Link any legacy single-landlord rows to the first landlord so existing data is preserved
    $firstLandlord = q("SELECT id FROM rentora_users WHERE role = 'landlord' ORDER BY id ASC LIMIT 1")->fetch();
    if ($firstLandlord) {
      $defLid = (int)$firstLandlord['id'];
      q("UPDATE rentora_users SET landlord_id = id WHERE role = 'landlord' AND landlord_id = 0");
      q("UPDATE rentora_users SET landlord_id = ? WHERE role = 'tenant' AND landlord_id = 0", [$defLid]);
      q("UPDATE rentora_tenants SET landlord_id = ? WHERE landlord_id = 0", [$defLid]);
      q("UPDATE rentora_invoices SET landlord_id = ? WHERE landlord_id = 0", [$defLid]);
      q("UPDATE rentora_announcements SET landlord_id = ? WHERE landlord_id = 0", [$defLid]);
      q("UPDATE rentora_settings SET landlord_id = ? WHERE id = 1 AND landlord_id = 0", [$defLid]);
    }

    // Allow different landlords to have the same room number (e.g., Room 101)
    $indexes = q("SHOW INDEX FROM rentora_tenants")->fetchAll();
    $uniqueGroups = [];
    foreach ($indexes as $idx) {
      if ((int)$idx['Non_unique'] === 0 && $idx['Key_name'] !== 'PRIMARY') {
        $uniqueGroups[$idx['Key_name']][] = $idx['Column_name'];
      }
    }
    $hasCompositeRoomKey = false;
    foreach ($uniqueGroups as $keyName => $cols) {
      if (in_array('landlord_id', $cols, true) && in_array('room_no', $cols, true)) {
        $hasCompositeRoomKey = true;
      } elseif (in_array('room_no', $cols, true) && !in_array('landlord_id', $cols, true)) {
        if (preg_match('/^[a-zA-Z0-9_]+$/', $keyName)) {
          q("ALTER TABLE rentora_tenants DROP INDEX `$keyName`");
        }
      }
    }
    if (!$hasCompositeRoomKey) {
      q("ALTER TABLE rentora_tenants ADD UNIQUE KEY uq_landlord_room (landlord_id, room_no)");
    }
  } catch (Throwable $e) {
    error_log('Schema sync warning: ' . $e->getMessage());
  }
}

function current_landlord_id($u) {
  if (!$u) return 0;
  if (($u['role'] ?? '') === 'landlord') {
    return (int)$u['id'];
  }
  $lid = (int)($u['landlord_id'] ?? 0);
  if ($lid > 0) return $lid;
  if (!empty($u['room'])) {
    $tr = q('SELECT landlord_id FROM rentora_tenants WHERE LOWER(room_no) = LOWER(?) LIMIT 1', [$u['room']])->fetch();
    if ($tr && (int)$tr['landlord_id'] > 0) {
      return (int)$tr['landlord_id'];
    }
  }
  return 0;
}

function start_session($uid) {
  session_regenerate_id(true);
  $_SESSION['uid'] = (int)$uid;
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function user_out($u) {
  $lid = current_landlord_id($u);
  $gender = 'Male';
  $houseName = trim((string)($u['house_name'] ?? ''));

  if (($u['role'] ?? '') === 'tenant') {
    if (!empty($u['room'])) {
      $tr = q('SELECT gender FROM rentora_tenants WHERE landlord_id = ? AND LOWER(room_no) = LOWER(?) LIMIT 1', [$lid, $u['room']])->fetch();
      if ($tr && !empty($tr['gender'])) {
        $gender = $tr['gender'];
      }
    }
    if ($houseName === '' && $lid > 0) {
      $lr = q('SELECT house_name FROM rentora_users WHERE id = ? LIMIT 1', [$lid])->fetch();
      if ($lr && !empty($lr['house_name'])) {
        $houseName = trim((string)$lr['house_name']);
      }
    }
  }

  return [
    'username' => $u['username'],
    'role' => $u['role'],
    'room' => $u['room'],
    'gender' => $gender,
    'houseName' => $houseName !== '' ? $houseName : 'Rentora Boarding House'
  ];
}

function has_landlord() {
  return (bool)q("SELECT 1 FROM rentora_users WHERE role = 'landlord' LIMIT 1")->fetch();
}

function cfg_row($lid) {
  $r = q('SELECT * FROM rentora_settings WHERE landlord_id = ? LIMIT 1', [$lid])->fetch();
  if (!$r) {
    $r = q('SELECT * FROM rentora_settings WHERE id = 1')->fetch();
  }
  if (!$r) {
    return ['waterFee' => 150.00, 'ratePerKwh' => 14.2700];
  }
  $rate = isset($r['rate_per_kwh']) && (float)$r['rate_per_kwh'] > 0
    ? (float)$r['rate_per_kwh']
    : (((float)$r['main_kwh'] > 0) ? round((float)$r['main_bill'] / (float)$r['main_kwh'], 4) : 14.2700);
  return [
    'waterFee' => (float)$r['water_fee'],
    'ratePerKwh' => round($rate, 4)
  ];
}

function save_cfg($lid, $ratePerKwh, $waterFee) {
  $ex = q('SELECT id FROM rentora_settings WHERE landlord_id = ? LIMIT 1', [$lid])->fetch();
  if ($ex) {
    q('UPDATE rentora_settings SET rate_per_kwh = ?, water_fee = ? WHERE landlord_id = ?', [
      $ratePerKwh, $waterFee, $lid
    ]);
    return;
  }
  $nextId = (int)q('SELECT COALESCE(MAX(id), 0) + 1 FROM rentora_settings')->fetchColumn();
  if (table_has_col('rentora_settings', 'main_bill') && table_has_col('rentora_settings', 'main_kwh')) {
    q('INSERT INTO rentora_settings (id, landlord_id, main_bill, main_kwh, water_fee, rate_per_kwh) VALUES (?, ?, 0, 0, ?, ?)', [
      $nextId, $lid, $waterFee, $ratePerKwh
    ]);
  } else {
    q('INSERT INTO rentora_settings (id, landlord_id, water_fee, rate_per_kwh) VALUES (?, ?, ?, ?)', [
      $nextId, $lid, $waterFee, $ratePerKwh
    ]);
  }
}

function inv_map($r) {
  return [
    'id' => $r['code'],
    'tenantId' => (int)$r['tenant_id'],
    'room' => $r['room_no'],
    'tenantName' => $r['tenant_name'],
    'period' => $r['bill_period'],
    'prevReading' => (float)$r['prev_reading'],
    'currReading' => (float)$r['curr_reading'],
    'kwhUsed' => (float)$r['kwh_used'],
    'ratePerKwh' => (float)$r['rate_per_kwh'],
    'powerAmount' => (float)$r['power_amount'],
    'waterAmount' => (float)$r['water_amount'],
    'rentAmount' => (float)$r['rent_amount'],
    'totalAmount' => (float)$r['total_amount'],
    'amountPaid' => (float)$r['amount_paid'],
    'status' => $r['status'],
    'paidAt' => $r['paid_at'],
    'payMethod' => $r['pay_method'],
    'createdAt' => $r['created_at'],
    'voidReason' => $r['void_reason']
  ];
}

function get_room($lid) {
  $t = q('SELECT * FROM rentora_tenants WHERE id = ? AND landlord_id = ?', [
    (int)($_POST['room_id'] ?? 0),
    $lid
  ])->fetch();
  if (!$t) fail('Room not found.', 404);
  return $t;
}

function get_bill($lid) {
  $i = q('SELECT * FROM rentora_invoices WHERE code = ? AND landlord_id = ?', [
    (string)($_POST['invoice_code'] ?? ''),
    $lid
  ])->fetch();
  if (!$i) fail('Bill not found.', 404);
  if ($i['status'] === 'Void') fail('This bill is void.', 409);
  return $i;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$isPost = ($_SERVER['REQUEST_METHOD'] === 'POST');
$me = null;

try {
  ensure_multi_landlord_schema();

  if (!empty($_SESSION['uid'])) {
    $me = q('SELECT id, username, role, room, landlord_id, house_name FROM rentora_users WHERE id = ?', [$_SESSION['uid']])->fetch() ?: null;
  }
  function need($role = null) {
    global $me;
    if (!$me) fail('Please sign in.', 401);
    if ($role && $me['role'] !== $role) fail('Only the landlord can do this.', 403);
  }
  if (!in_array($action, ['ping', 'load'], true) && !$isPost) fail('POST required.', 405);
  if ($isPost && !hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
    fail('Security check failed. Reload the page.', 403);
  }

  switch ($action) {
    case 'ping':
      $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
      out([
        'backend' => true,
        'csrf' => $_SESSION['csrf'],
        'canRegister' => true,
        'hasLandlord' => has_landlord(),
        'user' => $me ? user_out($me) : null
      ]);

   case 'register':
      $houseName = opt_txt('house_name', 120);
      $u = uname($_POST['username'] ?? '');
      $p = (string)($_POST['password'] ?? '');
      pass_ok($p);

      if (q('SELECT 1 FROM rentora_users WHERE username = ? LIMIT 1', [$u])->fetch()) {
        fail('That username is already taken. Please choose another.', 409);
      }

      try {
        q('INSERT INTO rentora_users (username, pass_hash, role, room, landlord_id, house_name) VALUES (?, ?, ?, ?, 0, ?)', [
          $u, password_hash($p, PASSWORD_DEFAULT), 'landlord', '', $houseName
        ]);
        $newId = (int)$db->lastInsertId();
        q('UPDATE rentora_users SET landlord_id = ? WHERE id = ?', [$newId, $newId]);
        save_cfg($newId, 14.2700, 150.00);
        start_session($newId);
        out([
          'csrf' => $_SESSION['csrf'],
          'user' => [
            'username' => $u,
            'role' => 'landlord',
            'room' => '',
            'gender' => 'Male',
            'houseName' => $houseName
          ]
        ]);
      } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
          fail('That username is already taken. Please choose another.', 409);
        }
        throw $e;
      }

    case 'login':
      $u = strtolower(trim((string)($_POST['username'] ?? '')));
      $p = (string)($_POST['password'] ?? '');
      $r = q('SELECT * FROM rentora_users WHERE username = ?', [$u])->fetch();
      if ($r && (int)$r['locked_until'] > time()) {
        fail('Too many wrong tries. Try again in 15 minutes.', 429);
      }
      if (!$r || !password_verify($p, $r['pass_hash'])) {
        if ($r) {
          $f = (int)$r['fails'] + 1;
          q('UPDATE rentora_users SET fails = ?, locked_until = ? WHERE id = ?', [
            $f >= 5 ? 0 : $f,
            $f >= 5 ? time() + 900 : 0,
            $r['id']
          ]);
        }
        fail('Wrong username or password.', 401);
      }
      q('UPDATE rentora_users SET fails = 0, locked_until = 0 WHERE id = ?', [$r['id']]);
      start_session($r['id']);
      out(['csrf' => $_SESSION['csrf'], 'user' => user_out($r)]);

    case 'logout':
      $_SESSION = [];
      session_destroy();
      out();

    case 'change_password':
      need();
      $p = (string)($_POST['password'] ?? '');
      pass_ok($p);
      $r = q('SELECT pass_hash FROM rentora_users WHERE id = ?', [$me['id']])->fetch();
      if (!password_verify((string)($_POST['current'] ?? ''), $r['pass_hash'])) {
        fail('Current password is wrong.', 403);
      }
      q('UPDATE rentora_users SET pass_hash = ? WHERE id = ?', [
        password_hash($p, PASSWORD_DEFAULT),
        $me['id']
      ]);
      out();

    case 'update_house_name':
      need('landlord');
      $houseName = txt('house_name', 120);
      q('UPDATE rentora_users SET house_name = ? WHERE id = ?', [$houseName, $me['id']]);
      out(['houseName' => $houseName]);

    case 'load':
      need();
      $land = ($me['role'] === 'landlord');
      $lid = current_landlord_id($me);
      $tenants = [];

      if ($land) {
        $sqlTenants = "SELECT t.*, (SELECT username FROM rentora_users u WHERE u.role = 'tenant' AND u.landlord_id = t.landlord_id AND LOWER(u.room) = LOWER(t.room_no) LIMIT 1) AS login
                       FROM rentora_tenants t
                       WHERE t.landlord_id = ?
                       ORDER BY CASE WHEN t.last_name = '' THEN 1 ELSE 0 END, t.last_name ASC, t.first_name ASC, t.room_no ASC";
        foreach (q($sqlTenants, [$lid])->fetchAll() as $t) {
          $fullName = (!empty($t['last_name']) && !empty($t['first_name']))
            ? format_full_name($t['last_name'], $t['first_name'], $t['middle_name'] ?? '')
            : (string)$t['tenant_name'];
          $tenants[] = [
            'id' => (int)$t['id'],
            'room' => $t['room_no'],
            'lastName' => $t['last_name'] ?? '',
            'firstName' => $t['first_name'] ?? '',
            'middleName' => $t['middle_name'] ?? '',
            'gender' => !empty($t['gender']) ? $t['gender'] : 'Male',
            'name' => $fullName,
            'phone' => $t['phone'],
            'rent' => (float)$t['base_rent'],
            'currentMeter' => (float)$t['current_meter'],
            'login' => $t['login']
          ];
        }
        $rows = q('SELECT * FROM rentora_invoices WHERE landlord_id = ? ORDER BY id DESC', [$lid])->fetchAll();
        $annRows = q('SELECT * FROM rentora_announcements WHERE landlord_id = ? ORDER BY created_at DESC, id DESC', [$lid])->fetchAll();
        $tenantAccounts = (int)q("SELECT COUNT(*) FROM rentora_users WHERE role = 'tenant' AND landlord_id = ?", [$lid])->fetchColumn();
        $houseName = trim((string)($me['house_name'] ?? ''));
        if ($houseName === '') $houseName = 'Rentora Boarding House';

        $profile = [
          'username' => $me['username'],
          'role' => 'landlord',
          'gender' => 'Male',
          'houseName' => $houseName,
          'fullName' => $houseName,
          'room' => 'All Rooms',
          'phone' => '-',
          'baseRent' => 0,
          'currentMeter' => 0,
          'totalRooms' => count($tenants),
          'tenantAccounts' => $tenantAccounts
        ];
      } else {
        $rows = q('SELECT * FROM rentora_invoices WHERE landlord_id = ? AND LOWER(room_no) = LOWER(?) ORDER BY id DESC', [$lid, $me['room']])->fetchAll();
        $annRows = q("SELECT * FROM rentora_announcements WHERE landlord_id = ? AND (target_room = 'ALL' OR LOWER(target_room) = LOWER(?)) ORDER BY created_at DESC, id DESC", [$lid, $me['room']])->fetchAll();
        $tRow = q('SELECT * FROM rentora_tenants WHERE landlord_id = ? AND LOWER(room_no) = LOWER(?) LIMIT 1', [$lid, $me['room']])->fetch();
        $lRow = q('SELECT house_name FROM rentora_users WHERE id = ? LIMIT 1', [$lid])->fetch();
        $houseName = trim((string)($lRow['house_name'] ?? ''));
        if ($houseName === '') $houseName = 'Rentora Boarding House';

        $tFullName = $tRow
          ? ((!empty($tRow['last_name']) && !empty($tRow['first_name']))
              ? format_full_name($tRow['last_name'], $tRow['first_name'], $tRow['middle_name'] ?? '')
              : (string)$tRow['tenant_name'])
          : $me['username'];
        $profile = [
          'username' => $me['username'],
          'role' => 'tenant',
          'gender' => ($tRow && !empty($tRow['gender'])) ? $tRow['gender'] : 'Male',
          'houseName' => $houseName,
          'fullName' => $tFullName,
          'lastName' => $tRow['last_name'] ?? '',
          'firstName' => $tRow['first_name'] ?? '',
          'middleName' => $tRow['middle_name'] ?? '',
          'room' => $tRow['room_no'] ?? $me['room'],
          'phone' => $tRow['phone'] ?? 'Not set',
          'baseRent' => $tRow ? (float)$tRow['base_rent'] : 0,
          'currentMeter' => $tRow ? (float)$tRow['current_meter'] : 0
        ];
      }

      $announcements = array_map(function ($a) {
        return [
          'id' => (int)$a['id'],
          'title' => $a['title'],
          'body' => $a['body'],
          'priority' => $a['priority'],
          'targetRoom' => $a['target_room'],
          'postedBy' => $a['posted_by'],
          'createdAt' => $a['created_at'],
          'updatedAt' => $a['updated_at']
        ];
      }, $annRows);

      out([
        'config' => $land ? cfg_row($lid) : ['waterFee' => 0, 'ratePerKwh' => 0],
        'profile' => $profile,
        'tenants' => $tenants,
        'invoices' => array_map('inv_map', $rows),
        'announcements' => $announcements
      ]);

    case 'add_room':
      need('landlord');
      $lid = current_landlord_id($me);
      $room = txt('room_no', 40);
      $last = txt('last_name', 60);
      $first = txt('first_name', 60);
      $middle = opt_txt('middle_name', 60);
      $gender = clean_gender($_POST['gender'] ?? 'Male');
      $fullName = format_full_name($last, $first, $middle);
      $phone = txt('phone', 40);
      $rent = num('base_rent');
      $meter = num('current_meter');
      $login = trim((string)($_POST['username'] ?? ''));

      if (q('SELECT 1 FROM rentora_tenants WHERE landlord_id = ? AND LOWER(room_no) = LOWER(?) LIMIT 1', [$lid, $room])->fetch()) {
        fail('You already registered that room number.', 409);
      }

      if ($login !== '') {
        $login = uname($login);
        pass_ok((string)($_POST['password'] ?? ''));
        if (q('SELECT 1 FROM rentora_users WHERE username = ? LIMIT 1', [$login])->fetch()) {
          fail('That tenant username is already taken. Choose another.', 409);
        }
      }

      try {
        $db->beginTransaction();
        q('INSERT INTO rentora_tenants (landlord_id, room_no, last_name, first_name, middle_name, gender, tenant_name, phone, base_rent, current_meter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
          $lid, $room, $last, $first, $middle, $gender, $fullName, $phone, $rent, $meter
        ]);
        if ($login !== '') {
          q('INSERT INTO rentora_users (username, pass_hash, role, room, landlord_id) VALUES (?, ?, ?, ?, ?)', [
            $login, password_hash((string)$_POST['password'], PASSWORD_DEFAULT), 'tenant', $room, $lid
          ]);
        }
        $db->commit();
        out();
      } catch (PDOException $e) {
        $db->rollBack();
        if ($e->getCode() === '23000') fail('That room or username is already used.', 409);
        throw $e;
      }

    case 'delete_room':
      need('landlord');
      $lid = current_landlord_id($me);
      $t = get_room($lid);
      q('DELETE FROM rentora_users WHERE role = ? AND landlord_id = ? AND LOWER(room) = LOWER(?)', ['tenant', $lid, $t['room_no']]);
      q('DELETE FROM rentora_tenants WHERE id = ? AND landlord_id = ?', [$t['id'], $lid]);
      out();

    case 'set_tenant_login':
      need('landlord');
      $lid = current_landlord_id($me);
      $t = get_room($lid);
      $u = uname($_POST['username'] ?? '');
      $p = (string)($_POST['password'] ?? '');
      pass_ok($p);
      $h = password_hash($p, PASSWORD_DEFAULT);
      $ex = q('SELECT id FROM rentora_users WHERE role = ? AND landlord_id = ? AND LOWER(room) = LOWER(?)', ['tenant', $lid, $t['room_no']])->fetch();
      if ($ex) {
        $taken = q('SELECT 1 FROM rentora_users WHERE username = ? AND id <> ? LIMIT 1', [$u, $ex['id']])->fetch();
        if ($taken) fail('That username is already used.', 409);
        q('UPDATE rentora_users SET username = ?, pass_hash = ?, fails = 0, locked_until = 0 WHERE id = ?', [$u, $h, $ex['id']]);
      } else {
        try {
          q('INSERT INTO rentora_users (username, pass_hash, role, room, landlord_id) VALUES (?, ?, ?, ?, ?)', [$u, $h, 'tenant', $t['room_no'], $lid]);
        } catch (PDOException $e) {
          fail('That username is already used.', 409);
        }
      }
      out();

    case 'create_bill':
      need('landlord');
      $lid = current_landlord_id($me);
      $t = get_room($lid);
      $per = (string)($_POST['billing_period'] ?? '');
      if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $per)) fail('Pick a valid billing month.');
      $curr = num('curr_reading');
      $prev = (float)$t['current_meter'];
      $ratePerKwh = num('rate_per_kwh', 0.01, 4);
      $waterFee = num('water_fee', 0, 2);

      if ($curr < $prev) fail('Current reading cannot be lower than the previous reading.');
      if (q("SELECT 1 FROM rentora_invoices WHERE landlord_id = ? AND tenant_id = ? AND bill_period = ? AND status <> 'Void'", [$lid, $t['id'], $per])->fetch()) {
        fail('This room already has a bill for that month. Void it first.', 409);
      }

      $fullName = (!empty($t['last_name']) && !empty($t['first_name']))
        ? format_full_name($t['last_name'], $t['first_name'], $t['middle_name'] ?? '')
        : (string)$t['tenant_name'];

      $kwh = round($curr - $prev, 2);
      $pow = round($kwh * $ratePerKwh, 2);
      $wat = round($waterFee, 2);
      $rent = round((float)$t['base_rent'], 2);
      $code = 'INV-' . strtoupper(base_convert((string)(int)(microtime(true) * 1000), 10, 36));

      $db->beginTransaction();
      q('INSERT INTO rentora_invoices (landlord_id, code, tenant_id, room_no, tenant_name, bill_period, prev_reading, curr_reading, kwh_used, rate_per_kwh, power_amount, water_amount, rent_amount, total_amount, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        $lid, $code, $t['id'], $t['room_no'], $fullName, $per, $prev, $curr, $kwh, $ratePerKwh, $pow, $wat, $rent, round($pow + $wat + $rent, 2), date('Y-m-d')
      ]);
      q('UPDATE rentora_tenants SET current_meter = ? WHERE id = ? AND landlord_id = ?', [$curr, $t['id'], $lid]);
      save_cfg($lid, $ratePerKwh, $wat);
      $db->commit();
      out(['code' => $code]);

    case 'record_payment':
      need('landlord');
      $lid = current_landlord_id($me);
      $i = get_bill($lid);
      $new = num('amount_paid');
      $tot = (float)$i['total_amount'];
      if ($new <= (float)$i['amount_paid'] || $new > $tot) {
        fail('The payment must be more than 0 and not more than the balance.');
      }
      q('UPDATE rentora_invoices SET amount_paid = ?, status = ?, paid_at = ?, pay_method = ? WHERE id = ? AND landlord_id = ?', [
        $new,
        $new >= $tot ? 'Paid' : 'Partial',
        date('Y-m-d'),
        ssub((string)($_POST['pay_method'] ?? ''), 1000),
        $i['id'],
        $lid
      ]);
      out();

    case 'void_bill':
      need('landlord');
      $lid = current_landlord_id($me);
      $i = get_bill($lid);
      $why = txt('reason', 500);
      q("UPDATE rentora_invoices SET status = 'Void', void_reason = ? WHERE id = ? AND landlord_id = ?", [$why, $i['id'], $lid]);
      q('UPDATE rentora_tenants SET current_meter = ? WHERE id = ? AND landlord_id = ? AND current_meter = ?', [
        $i['prev_reading'],
        $i['tenant_id'],
        $lid,
        $i['curr_reading']
      ]);
      out();

    case 'save_announcement':
      need('landlord');
      $lid = current_landlord_id($me);
      $id = (int)($_POST['id'] ?? 0);
      $title = txt('title', 150);
      $body = txt('body', 3000);
      $priority = in_array($_POST['priority'] ?? '', ['normal', 'important', 'urgent'], true)
        ? $_POST['priority']
        : 'normal';
      $target = trim((string)($_POST['target_room'] ?? 'ALL'));
      if ($target === '') $target = 'ALL';
      if (slen($target) > 40) fail('Target room name is too long.');

      if ($id > 0) {
        q('UPDATE rentora_announcements SET title = ?, body = ?, priority = ?, target_room = ?, updated_at = NOW() WHERE id = ? AND landlord_id = ?', [
          $title, $body, $priority, $target, $id, $lid
        ]);
      } else {
        q('INSERT INTO rentora_announcements (landlord_id, title, body, priority, target_room, posted_by) VALUES (?, ?, ?, ?, ?, ?)', [
          $lid, $title, $body, $priority, $target, $me['username']
        ]);
      }
      out();

    case 'delete_announcement':
      need('landlord');
      $lid = current_landlord_id($me);
      $id = (int)($_POST['id'] ?? 0);
      if ($id <= 0) fail('Invalid announcement ID.');
      q('DELETE FROM rentora_announcements WHERE id = ? AND landlord_id = ?', [$id, $lid]);
      out();

    default:
      fail('Unknown action.', 404);
  }
} catch (Throwable $e) {
  error_log($e->getMessage());
  $m = $e->getMessage();
  if ($e instanceof PDOException && (strpos($m, 'Base table or view not found') !== false || strpos($m, 'no such table') !== false)) {
    fail('The database tables are missing or outdated. Run api/schema.sql in phpMyAdmin first.', 500);
  }
  fail('Server error. Please try again.', 500);
}