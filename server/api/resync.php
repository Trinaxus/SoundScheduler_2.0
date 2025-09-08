<?php
require __DIR__ . '/bootstrap.php';

// Scans UPLOAD_DIR for audio files and ensures they exist in manifest.sounds
// Only inserts missing files; does not remove any manifest entries.
// Requires admin session.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

// Allow anonymous resync if enabled via env; otherwise require admin
$allowAnonResync = ($_ENV['ALLOW_ANON_RESYNC'] ?? '') === 'true';
if (!$allowAnonResync) {
  require_admin();
}

// Build current set of known file_paths in manifest
$manifest = manifest_read();
$known = [];
foreach (($manifest['sounds'] ?? []) as $s) {
  if (!empty($s['file_path'])) $known[$s['file_path']] = true;
}

// Scan uploads directory
$added = [];
$errors = [];

try {
  global $UPLOAD_DIR;
  $root = rtrim($UPLOAD_DIR, '/');
  if (!is_dir($root)) {
    json_out(['error' => 'Upload directory not found', 'dir' => $root], 500);
  }

  $dh = new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS);
  $it = new RecursiveIteratorIterator($dh);
  $allowed = allowed_audio_mimes();

  $candidates = [];
  foreach ($it as $file) {
    if (!$file->isFile()) continue;
    $full = $file->getPathname();
    // mime check
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $full) ?: '';
    finfo_close($finfo);
    if (!in_array($mime, $allowed, true)) continue;

    $rel = 'uploads/sounds/' . basename($full);
    if (!isset($known[$rel])) {
      $candidates[] = [
        'rel' => $rel,
        'mime' => $mime,
        'size' => filesize($full) ?: 0,
        'name' => pathinfo($full, PATHINFO_FILENAME),
      ];
    }
  }

  if (empty($candidates)) {
    json_out(['version' => $manifest['version'] ?? 0, 'added' => [], 'ok' => true]);
  }

  // Insert all missing files
  $result = manifest_write(function(array $data) use ($candidates) {
    $orderStart = count($data['sounds'] ?? []);
    foreach ($candidates as $i => $c) {
      $data['sounds'][] = [
        'id' => uuidv4(),
        'name' => $c['name'],
        'url' => file_public_url($c['rel']),
        'file_path' => $c['rel'],
        'size' => $c['size'],
        'type' => $c['mime'],
        'duration' => 0,
        'display_order' => $orderStart + $i,
        'is_favorite' => false,
        'category_id' => null,
      ];
    }
    return $data;
  });

  $newSounds = array_slice($result['sounds'], -count($candidates));
  json_out(['version' => $result['version'], 'added' => $newSounds, 'ok' => true]);
} catch (Throwable $e) {
  json_out(['error' => 'Resync failed', 'details' => $e->getMessage()], 500);
}
