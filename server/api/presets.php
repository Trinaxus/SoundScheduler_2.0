<?php
require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Basic auth check: rely on session from bootstrap (adjust if your project differs)
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
$file = $dataDir . '/presets.json';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0775, true);
}
if (!file_exists($file)) {
    file_put_contents($file, json_encode(['presets' => []], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function load_presets($file) {
    $raw = @file_get_contents($file);
    if ($raw === false) return ['presets' => []];
    $json = json_decode($raw, true);
    if (!is_array($json)) return ['presets' => []];
    if (!isset($json['presets']) || !is_array($json['presets'])) $json['presets'] = [];
    return $json;
}

function save_presets($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

try {
    if ($action === 'list') {
        if ($method !== 'GET') { http_response_code(405); echo json_encode(['error' => 'method not allowed']); exit; }
        $data = load_presets($file);
        echo json_encode(['presets' => $data['presets']]);
        exit;
    }

    if ($action === 'upsert') {
        if ($method !== 'POST') { http_response_code(405); echo json_encode(['error' => 'method not allowed']); exit; }
        $id = $_POST['id'] ?? '';
        $name = $_POST['name'] ?? '';
        $segmentsJson = $_POST['segments'] ?? '[]';
        $segments = json_decode($segmentsJson, true);
        $soundsBySegmentJson = $_POST['soundsBySegment'] ?? null;
        $soundsBySegment = null;
        if ($soundsBySegmentJson !== null) {
            $tmp = json_decode($soundsBySegmentJson, true);
            if (is_array($tmp)) $soundsBySegment = $tmp;
        }
        if (!$id || !$name || !is_array($segments)) {
            http_response_code(400);
            echo json_encode(['error' => 'invalid payload']);
            exit;
        }
        $data = load_presets($file);
        $updated = false;
        foreach ($data['presets'] as &$p) {
            if (($p['id'] ?? '') === $id) {
                $p['name'] = $name;
                $p['segments'] = $segments;
                if ($soundsBySegment !== null) {
                    $p['soundsBySegment'] = $soundsBySegment;
                }
                $updated = true;
                break;
            }
        }
        if (!$updated) {
            $preset = [ 'id' => $id, 'name' => $name, 'segments' => $segments ];
            if ($soundsBySegment !== null) $preset['soundsBySegment'] = $soundsBySegment;
            $data['presets'][] = $preset;
        }
        save_presets($file, $data);
        $resp = [ 'id' => $id, 'name' => $name, 'segments' => $segments ];
        if ($soundsBySegment !== null) $resp['soundsBySegment'] = $soundsBySegment;
        echo json_encode(['ok' => true, 'preset' => $resp]);
        exit;
    }

    if ($action === 'delete') {
        if ($method !== 'POST') { http_response_code(405); echo json_encode(['error' => 'method not allowed']); exit; }
        $id = $_POST['id'] ?? '';
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'invalid payload']); exit; }
        $data = load_presets($file);
        $data['presets'] = array_values(array_filter($data['presets'], function($p) use ($id) {
            return ($p['id'] ?? '') !== $id;
        }));
        save_presets($file, $data);
        echo json_encode(['ok' => true]);
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
