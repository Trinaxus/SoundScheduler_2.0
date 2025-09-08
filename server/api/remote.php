<?php
// server/api/remote.php
// Minimal remote control endpoint without Supabase.
// Stores the latest command (action, soundId, ts) in server/data/remote.json

header('Content-Type: application/json');
require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? ($method === 'GET' ? 'get' : 'send');

$dataDir = realpath(__DIR__ . '/../data');
if ($dataDir === false) {
  http_response_code(500);
  echo json_encode(['error' => 'Data directory not found']);
  exit;
}
$file = $dataDir . '/remote.json';

function read_last_command($file) {
  if (!file_exists($file)) return null;
  $raw = @file_get_contents($file);
  if ($raw === false || $raw === '') return null;
  $json = json_decode($raw, true);
  if (!is_array($json)) return null;
  return $json;
}

if ($action === 'get') {
  $last = read_last_command($file);
  echo json_encode(['ok' => true, 'command' => $last]);
  exit;
}

if ($action === 'send') {
  // Accept JSON or form
  $payload = null;
  $ct = $_SERVER['CONTENT_TYPE'] ?? '';
  if (stripos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
  } else {
    $payload = $_POST;
  }
  if (!is_array($payload)) $payload = [];

  $cmd = [];
  $cmd['action'] = isset($payload['action']) ? strtolower((string)$payload['action']) : '';
  $cmd['soundId'] = isset($payload['soundId']) ? (string)$payload['soundId'] : null;
  $cmd['ts'] = round(microtime(true) * 1000);

  if ($cmd['action'] === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing action']);
    exit;
  }

  // Persist atomically
  $tmp = $file . '.tmp';
  if (@file_put_contents($tmp, json_encode($cmd, JSON_UNESCAPED_SLASHES)) === false || !@rename($tmp, $file)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write remote state']);
    exit;
  }

  echo json_encode(['ok' => true, 'command' => $cmd]);
  exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid action']);
