<?php
require __DIR__ . '/bootstrap.php';

// Returns simple auth status for the current session
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_out(['error' => 'Method not allowed'], 405);
}

$authenticated = (!empty($_SESSION['admin']) && $_SESSION['admin'] === true) || (!empty($_SESSION['remote']) && $_SESSION['remote'] === true);
$role = null;
if (!empty($_SESSION['admin']) && $_SESSION['admin'] === true) $role = 'admin';
if (!empty($_SESSION['remote']) && $_SESSION['remote'] === true) $role = 'remote';
json_out(['authenticated' => $authenticated, 'role' => $role]);
