<?php
require_once '../config/config.php';
require_once '../config/database.php';
require_once '../includes/auth.php';

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

if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($input['action']) {
        case 'set_pin':
            $pin_hash = password_hash($input['pin'], PASSWORD_DEFAULT);
            $stmt = $db->prepare("UPDATE users SET pin_hash = ? WHERE id = ?");
            $stmt->execute([$pin_hash, $user['id']]);
            
            echo json_encode(['success' => true, 'pin_hash' => $pin_hash]);
            break;
            
        case 'toggle_keep_unlocked':
            $stmt = $db->prepare("UPDATE users SET keep_unlocked = ? WHERE id = ?");
            $stmt->execute([$input['enabled'] ? 1 : 0, $user['id']]);
            
            echo json_encode(['success' => true]);
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Unknown action']);
            break;
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>
