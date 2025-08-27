<?php
require_once '../config/config.php';
require_once '../config/database.php';
require_once '../includes/auth.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if (!$auth_header || !str_starts_with($auth_header, 'Bearer ')) {
    echo json_encode(['success' => false, 'error' => 'Missing authorization']);
    exit;
}

$init_data = substr($auth_header, 7);
$auth_result = authenticateUser($init_data);

if (!$auth_result['success']) {
    echo json_encode($auth_result);
    exit;
}

$user = $auth_result['user'];
$database = new Database();
$db = $database->getConnection();

if ($method === 'POST') {
    // Generate export token
    $token = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', time() + 24 * 60 * 60); // 24 hours
    
    // Delete old tokens for this user
    $stmt = $db->prepare("DELETE FROM export_tokens WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    
    // Insert new token
    $stmt = $db->prepare("INSERT INTO export_tokens (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$user['id'], $token, $expires_at]);
    
    echo json_encode(['success' => true, 'token' => $token]);
} else {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>
