<?php
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

$body = read_json_body();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

$envUser = $_ENV['ADMIN_USERNAME'] ?? '';
$envHash = $_ENV['ADMIN_PASSWORD_HASH'] ?? '';

// Allow either the admin username, or a special 'remote' username that shares the same password
$isAdminAttempt = strcasecmp($username, $envUser) === 0;
$isRemoteAttempt = strcasecmp($username, 'remote') === 0;

if ((!$isAdminAttempt && !$isRemoteAttempt) || empty($envHash) || !password_verify($password, $envHash)) {
  usleep(300000); // slow down brute-force
  json_out(['error' => 'Unauthorized'], 401);
}

session_regenerate_id(true);
if ($isAdminAttempt) {
  $_SESSION['admin'] = true;
  $_SESSION['remote'] = false;
  json_out(['ok' => true, 'role' => 'admin']);
} else {
  $_SESSION['admin'] = false;
  $_SESSION['remote'] = true;
  json_out(['ok' => true, 'role' => 'remote']);
}
