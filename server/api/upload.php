<?php
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

// Allow anonymous uploads if enabled via env; otherwise require admin
$allowAnon = ($_ENV['ALLOW_ANON_UPLOADS'] ?? '') === 'true';
if (!$allowAnon) {
  require_admin();
}

if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
  json_out(['error' => 'No file uploaded'], 400);
}

$file = $_FILES['file'];
$mime = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
$allowed = allowed_audio_mimes();
if (!in_array($mime, $allowed, true)) {
  json_out(['error' => 'Unsupported file type', 'mime' => $mime], 415);
}

$originalName = $file['name'];
$ext = pathinfo($originalName, PATHINFO_EXTENSION);
$base = pathinfo($originalName, PATHINFO_FILENAME);
$unique = $base . '_' . time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . ($ext ? ".{$ext}" : '');

// Build relative path used for public URL and compute absolute path using UPLOAD_DIR
$relativePath = 'uploads/sounds/' . $unique; // public path under BASE_URL
global $UPLOAD_DIR;
$targetDir = rtrim($UPLOAD_DIR, '/');
@mkdir($targetDir, 0775, true);
$targetFile = $targetDir . '/' . basename($unique);

if (!move_uploaded_file($file['tmp_name'], $targetFile)) {
  json_out(['error' => 'Failed to store file'], 500);
}

$url = file_public_url($relativePath);

$response = [
  'name' => $originalName,
  'url' => $url,
  'file_path' => $relativePath,
  'size' => filesize($targetFile),
  'type' => $mime,
];

json_out($response, 201);
