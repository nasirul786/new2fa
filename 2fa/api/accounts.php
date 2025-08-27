<?php
require_once '../config/config.php';
require_once '../config/database.php';
require_once '../includes/auth.php';
require_once '../includes/totp.php';

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

switch ($method) {
    case 'GET':
        // Get all accounts for user
        $stmt = $db->prepare("SELECT * FROM auth_accounts WHERE user_id = ? ORDER BY position ASC");
        $stmt->execute([$user['id']]);
        $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Generate current TOTP codes
        foreach ($accounts as &$account) {
            $account['code'] = TOTP::generateCode($account['secret']);
        }
        
        echo json_encode([
            'success' => true,
            'accounts' => $accounts,
            'remaining_time' => TOTP::getRemainingTime()
        ]);
        break;
        
    case 'POST':
        // Create new account
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['label']) || !isset($input['secret'])) {
            echo json_encode(['success' => false, 'error' => 'Missing required fields']);
            exit;
        }
        
        // Get next position
        $stmt = $db->prepare("SELECT MAX(position) as max_pos FROM auth_accounts WHERE user_id = ?");
        $stmt->execute([$user['id']]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $position = ($result['max_pos'] ?? -1) + 1;
        
        $stmt = $db->prepare("INSERT INTO auth_accounts (user_id, label, service, secret, icon, color, position) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $user['id'],
            $input['label'],
            $input['service'] ?? '',
            $input['secret'],
            $input['icon'] ?? 'key',
            $input['color'] ?? '#2196F3',
            $position
        ]);
        
        echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
        break;
        
    case 'PUT':
        // Update account
        $account_id = $_GET['id'] ?? null;
        if (!$account_id) {
            echo json_encode(['success' => false, 'error' => 'Missing account ID']);
            exit;
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $db->prepare("UPDATE auth_accounts SET label = ?, service = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([
            $input['label'],
            $input['service'] ?? '',
            $input['icon'] ?? 'key',
            $input['color'] ?? '#2196F3',
            $account_id,
            $user['id']
        ]);
        
        echo json_encode(['success' => true]);
        break;
        
    case 'DELETE':
        if (isset($_GET['id'])) {
            // Delete specific account
            $account_id = $_GET['id'];
            $stmt = $db->prepare("DELETE FROM auth_accounts WHERE id = ? AND user_id = ?");
            $stmt->execute([$account_id, $user['id']]);
        } else {
            // Delete all accounts
            $stmt = $db->prepare("DELETE FROM auth_accounts WHERE user_id = ?");
            $stmt->execute([$user['id']]);
        }
        
        echo json_encode(['success' => true]);
        break;
        
    case 'PATCH':
        // Reorder accounts
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($input['action'] === 'reorder') {
            $stmt = $db->prepare("UPDATE auth_accounts SET position = ? WHERE id = ? AND user_id = ?");
            $stmt->execute([$input['position'], $input['account_id'], $user['id']]);
            
            echo json_encode(['success' => true]);
        }
        break;
        
    default:
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        break;
}
?>
