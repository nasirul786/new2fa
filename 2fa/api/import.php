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
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['token'])) {
        echo json_encode(['success' => false, 'error' => 'Missing token']);
        exit;
    }
    
    // Verify token
    $stmt = $db->prepare("SELECT et.*, u.id as source_user_id FROM export_tokens et JOIN users u ON et.user_id = u.id WHERE et.token = ? AND et.expires_at > NOW()");
    $stmt->execute([$input['token']]);
    $token_data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$token_data) {
        echo json_encode(['success' => false, 'error' => 'Invalid or expired token']);
        exit;
    }
    
    // Prevent importing own data
    if ($token_data['source_user_id'] == $user['id']) {
        echo json_encode(['success' => false, 'error' => 'Cannot import your own export']);
        exit;
    }

    // Get accounts from source user
    $stmt = $db->prepare("SELECT * FROM auth_accounts WHERE user_id = ? ORDER BY position ASC");
    $stmt->execute([$token_data['source_user_id']]);
    $source_accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get next position for target user
    $stmt = $db->prepare("SELECT MAX(position) as max_pos FROM auth_accounts WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $position = ($result['max_pos'] ?? -1) + 1;
    
    // Import accounts
    $imported_count = 0;
    foreach ($source_accounts as $account) {
        $stmt = $db->prepare("INSERT INTO auth_accounts (user_id, label, service, secret, icon, color, position) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $user['id'],
            $account['label'],
            $account['service'],
            $account['secret'],
            $account['icon'],
            $account['color'],
            $position++
        ]);
        $imported_count++;
    }
    
    // Delete used token
    $stmt = $db->prepare("DELETE FROM export_tokens WHERE token = ?");
    $stmt->execute([$input['token']]);
    
    echo json_encode(['success' => true, 'count' => $imported_count]);
} else {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>
