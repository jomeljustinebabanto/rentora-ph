<?php
require __DIR__ . '/db.php';

function logAttempt($pdo, $username, $role, $status) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    $stmt = $pdo->prepare('INSERT INTO login_logs (username, role, ip_address, status) VALUES (?, ?, ?, ?)');
    $stmt->execute([$username, $role, $ip, $status]);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'login') {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');

    // Fetch user record from database
    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Record successful login
        logAttempt($pdo, $username, $user['role'], 'Success');

        session_start();
        $_SESSION['user'] = [
            'username' => $user['username'],
            'role' => $user['role'],
            'room_no' => $user['room_no'] ?? null
        ];

        echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
    } else {
        // Record failed login attempt
        $role = $user['role'] ?? 'unknown';
        logAttempt($pdo, $username, $role, 'Failed');

        echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
    }
    exit;
}