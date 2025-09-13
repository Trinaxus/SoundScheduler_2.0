<?php
require __DIR__ . '/bootstrap.php';

// Normalizes all sound.url fields to match file_public_url(sound.file_path)
// Requires admin session unless ALLOW_ANON_RESYNC=true is set (same as resync policy)

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

$allowAnonResync = ($_ENV['ALLOW_ANON_RESYNC'] ?? '') === 'true';
if (!$allowAnonResync) {
  require_admin();
}

try {
  $result = manifest_write(function(array $data) {
    if (!isset($data['sounds']) || !is_array($data['sounds'])) {
      $data['sounds'] = [];
    }
    foreach ($data['sounds'] as &$s) {
      if (!empty($s['file_path'])) {
        $s['url'] = file_public_url($s['file_path']);
      } elseif (!empty($s['url'])) {
        // If file_path is missing, try to derive from URL basename
        $base = basename(parse_url($s['url'], PHP_URL_PATH) ?? '');
        if ($base) {
          $s['file_path'] = 'uploads/sounds/' . $base;
          $s['url'] = file_public_url($s['file_path']);
        }
      }
    }
    return $data;
  });

  json_out([
    'ok' => true,
    'version' => $result['version'] ?? 0,
    'sounds' => $result['sounds'] ?? [],
  ]);
} catch (Throwable $e) {
  json_out(['error' => 'Normalization failed', 'details' => $e->getMessage()], 500);
}
