<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $data = manifest_read();
  $etag = (string)($data['version'] ?? 0);
  header('ETag: ' . $etag);
  json_out([
    'version' => $data['version'] ?? 0,
    'sounds' => $data['sounds'] ?? [],
  ]);
}

if ($method !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

require_admin();
$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$body = $_POST;
if (empty($body)) {
  // Allow JSON body too
  $body = read_json_body();
}

$expectedVersion = null;
$ifMatch = $_SERVER['HTTP_IF_MATCH'] ?? '';
if ($ifMatch !== '') {
  $expectedVersion = (int)$ifMatch;
}

switch ($action) {
  case 'insert': {
    $name = trim($body['name'] ?? '');
    $url = trim($body['url'] ?? '');
    $file_path = trim($body['file_path'] ?? '');
    $size = (int)($body['size'] ?? 0);
    $type = trim($body['type'] ?? '');
    $duration = (float)($body['duration'] ?? 0);
    $display_order = (int)($body['display_order'] ?? 0);
    $is_favorite = (bool)($body['is_favorite'] ?? false);
    $category_id = $body['category_id'] ?? null;

    if ($name === '' || $url === '' || $file_path === '') {
      json_out(['error' => 'Missing fields'], 400);
    }

    $result = manifest_write(function(array $data) use ($name,$url,$file_path,$size,$type,$duration,$display_order,$is_favorite,$category_id) {
      $id = uuidv4();
      $data['sounds'][] = [
        'id' => $id,
        'name' => $name,
        'url' => $url,
        'file_path' => $file_path,
        'size' => $size,
        'type' => $type,
        'duration' => $duration,
        'display_order' => $display_order,
        'is_favorite' => $is_favorite,
        'category_id' => $category_id,
      ];
      return $data;
    }, $expectedVersion);

    $newSound = end($result['sounds']);
    json_out(['version' => $result['version'], 'sound' => $newSound], 201);
  }

  case 'update': {
    $id = trim($body['id'] ?? '');
    if ($id === '') json_out(['error' => 'Missing id'], 400);

    $result = manifest_write(function(array $data) use ($id, $body) {
      foreach ($data['sounds'] as &$s) {
        if ($s['id'] === $id) {
          $fields = ['name','url','file_path','size','type','duration','display_order','is_favorite','category_id'];
          foreach ($fields as $field) {
            if (!array_key_exists($field, $body)) continue;
            $val = $body[$field];
            switch ($field) {
              case 'size':
              case 'display_order':
                $s[$field] = (int)$val;
                break;
              case 'duration':
                $s[$field] = (float)$val;
                break;
              case 'is_favorite':
                // Accept booleans and strings like 'true'/'false'
                if (is_string($val)) {
                  $v = strtolower($val);
                  $s[$field] = ($v === '1' || $v === 'true' || $v === 'on' || $v === 'yes');
                } else {
                  $s[$field] = (bool)$val;
                }
                break;
              case 'category_id':
                $s[$field] = ($val === '' || $val === null) ? null : (string)$val;
                break;
              default:
                $s[$field] = (string)$val;
            }
          }
          return $data;
        }
      }
      json_out(['error' => 'Not found'], 404);
    }, $expectedVersion);

    $updated = null;
    foreach ($result['sounds'] as $s) if ($s['id'] === $id) { $updated = $s; break; }
    json_out(['version' => $result['version'], 'sound' => $updated]);
  }

  case 'delete': {
    $id = trim($body['id'] ?? '');
    if ($id === '') json_out(['error' => 'Missing id'], 400);

    $result = manifest_write(function(array $data) use ($id) {
      $sounds = $data['sounds'] ?? [];
      $found = null;
      foreach ($sounds as $i => $s) {
        if ($s['id'] === $id) { $found = $s; unset($sounds[$i]); break; }
      }
      if ($found === null) json_out(['error' => 'Not found'], 404);
      // Remove related schedules
      $data['schedules'] = array_values(array_filter($data['schedules'] ?? [], fn($sch) => $sch['sound_id'] !== $id));
      $data['sounds'] = array_values($sounds);

      // Try to delete file from disk if inside our uploads dir (UPLOAD_DIR)
      if (!empty($found['file_path'])) {
        global $UPLOAD_DIR;
        $uploadsRoot = realpath(rtrim($UPLOAD_DIR, '/')) ?: '';
        $candidate = $uploadsRoot . '/' . basename($found['file_path']);
        $real = realpath($candidate) ?: '';
        if ($uploadsRoot && $real && str_starts_with($real, $uploadsRoot)) {
          @unlink($real);
        }
      }
      return $data;
    }, $expectedVersion);

    json_out(['version' => $result['version'], 'ok' => true]);
  }

  case 'reorder': {
    $orders = $body['orders'] ?? [];
    // Allow orders to be sent as JSON string inside form-data
    if (is_string($orders)) {
      $decoded = json_decode($orders, true);
      if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $orders = $decoded;
      }
    }
    if (!is_array($orders)) json_out(['error' => 'Invalid payload'], 400);

    $result = manifest_write(function(array $data) use ($orders) {
      $byId = [];
      foreach ($orders as $o) {
        if (!isset($o['id'])) continue;
        $byId[$o['id']] = (int)($o['display_order'] ?? 0);
      }
      foreach ($data['sounds'] as &$s) {
        if (isset($byId[$s['id']])) {
          $s['display_order'] = $byId[$s['id']];
        }
      }
      // Optional: normalize to 0..n-1
      usort($data['sounds'], fn($a,$b) => ($a['display_order'] ?? 0) <=> ($b['display_order'] ?? 0));
      foreach ($data['sounds'] as $i => &$s) { $s['display_order'] = $i; }
      return $data;
    }, $expectedVersion);

    json_out(['version' => $result['version'], 'ok' => true]);
  }

  default:
    json_out(['error' => 'Unknown action'], 400);
}
