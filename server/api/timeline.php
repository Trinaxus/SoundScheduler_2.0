<?php
require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Basic auth check (same pattern as presets.php)
if (!isset($_SESSION)) {
    session_start();
}
$authenticated = isset($_SESSION['authenticated']) ? (bool)$_SESSION['authenticated'] : true; // fallback true for local dev
if (!$authenticated) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$dataDir = dirname(__DIR__) . '/data';
$file = $dataDir . '/timeline.json';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}
if (!file_exists($file)) {
    file_put_contents($file, json_encode(['mutedSchedules' => [], 'mutedSegments' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function load_timeline($file) {
    $raw = @file_get_contents($file);
    if ($raw === false) return ['mutedSchedules' => [], 'mutedSegments' => []];
    $json = json_decode($raw, true);
    if (!is_array($json)) return ['mutedSchedules' => [], 'mutedSegments' => []];
    if (!isset($json['mutedSchedules']) || !is_array($json['mutedSchedules'])) $json['mutedSchedules'] = [];
    if (!isset($json['mutedSegments']) || !is_array($json['mutedSegments'])) $json['mutedSegments'] = [];
    return $json;
}

function save_timeline($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

try {
    if ($action === 'get') {
        if ($method !== 'GET') { http_response_code(405); echo json_encode(['error' => 'method not allowed']); exit; }
        $data = load_timeline($file);
        echo json_encode($data);
        exit;
    }

    if ($action === 'save') {
        if ($method !== 'POST') { http_response_code(405); echo json_encode(['error' => 'method not allowed']); exit; }
        $mutedJson = $_POST['mutedSchedules'] ?? '[]';
        $mutedSegJson = $_POST['mutedSegments'] ?? '[]';
        $muted = json_decode($mutedJson, true);
        $mutedSeg = json_decode($mutedSegJson, true);
        if (!is_array($muted)) { $muted = []; }
        if (!is_array($mutedSeg)) { $mutedSeg = []; }
        $data = [
            'mutedSchedules' => array_values(array_unique(array_map('strval', $muted))),
            'mutedSegments'  => array_values(array_unique(array_map('strval', $mutedSeg))),
        ];
        save_timeline($file, $data);
        echo json_encode(['ok' => true, 'mutedSchedules' => $data['mutedSchedules'], 'mutedSegments' => $data['mutedSegments']]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'unknown action']);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server error', 'message' => $e->getMessage()]);
    exit;
}
