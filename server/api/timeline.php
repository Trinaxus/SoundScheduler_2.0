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
    file_put_contents($file, json_encode([
        'mutedSchedules' => [],
        'mutedSegments' => [],
        'segments' => [],
        'activePresetId' => null,
        'activePresetName' => null,
        'soundsBySegment' => new stdClass(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function load_timeline($file) {
    $raw = @file_get_contents($file);
    if ($raw === false) return ['mutedSchedules' => [], 'mutedSegments' => [], 'segments' => [], 'activePresetId' => null, 'activePresetName' => null, 'soundsBySegment' => new stdClass()];
    $json = json_decode($raw, true);
    if (!is_array($json)) return ['mutedSchedules' => [], 'mutedSegments' => [], 'segments' => [], 'activePresetId' => null, 'activePresetName' => null, 'soundsBySegment' => new stdClass()];
    if (!isset($json['mutedSchedules']) || !is_array($json['mutedSchedules'])) $json['mutedSchedules'] = [];
    if (!isset($json['mutedSegments']) || !is_array($json['mutedSegments'])) $json['mutedSegments'] = [];
    if (!isset($json['segments']) || !is_array($json['segments'])) $json['segments'] = [];
    if (!array_key_exists('activePresetId', $json)) $json['activePresetId'] = null;
    if (!array_key_exists('activePresetName', $json)) $json['activePresetName'] = null;
    if (!isset($json['soundsBySegment']) || !is_array($json['soundsBySegment'])) $json['soundsBySegment'] = [];
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
        $segmentsJson = $_POST['segments'] ?? null;
        $segments = [];
        if ($segmentsJson !== null) {
            $tmp = json_decode($segmentsJson, true);
            if (is_array($tmp)) $segments = $tmp;
        }
        $activePresetId = $_POST['activePresetId'] ?? null;
        $activePresetName = $_POST['activePresetName'] ?? null;
        $soundsBySegmentJson = $_POST['soundsBySegment'] ?? null;
        $soundsBySegment = null;
        if ($soundsBySegmentJson !== null) {
            $tmp = json_decode($soundsBySegmentJson, true);
            if (is_array($tmp)) $soundsBySegment = $tmp;
        }
        if (!is_array($muted)) { $muted = []; }
        if (!is_array($mutedSeg)) { $mutedSeg = []; }
        $data = load_timeline($file);
        $data['mutedSchedules'] = array_values(array_unique(array_map('strval', $muted)));
        $data['mutedSegments']  = array_values(array_unique(array_map('strval', $mutedSeg)));
        if ($segmentsJson !== null) {
            // Replace segments only if provided
            $data['segments'] = $segments;
        }
        if ($activePresetId !== null || $activePresetName !== null) {
            $data['activePresetId'] = $activePresetId;
            $data['activePresetName'] = $activePresetName;
        }
        if ($soundsBySegment !== null) {
            $data['soundsBySegment'] = $soundsBySegment;
        }
        save_timeline($file, $data);
        echo json_encode([
            'ok' => true,
            'mutedSchedules' => $data['mutedSchedules'],
            'mutedSegments' => $data['mutedSegments'],
            'segments' => $data['segments'],
            'activePresetId' => $data['activePresetId'],
            'activePresetName' => $data['activePresetName'],
            'soundsBySegment' => $data['soundsBySegment'],
        ]);
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
