<?php
header('Content-Type: application/json');

error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    require_once '../config/config.php';
    require_once '../config/database.php';
    require_once '../includes/auth.php';
} catch (Exception $e) {
    error_log("Include error: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Server configuration error: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['init_data'])) {
            echo json_encode(['success' => false, 'error' => 'Missing init data']);
            exit;
        }
        
        if (!function_exists('authenticateUser')) {
            echo json_encode(['success' => false, 'error' => 'authenticateUser function not found']);
            exit;
        }
        
        $auth_result = authenticateUser($input['init_data']);
        
        if (!$auth_result['success']) {
            echo json_encode($auth_result);
            exit;
        }
        
        $user = $auth_result['user'];
        
        // If PIN is provided, verify it
        if (isset($input['pin'])) {
            if (!$user['pin_hash']) {
                echo json_encode(['success' => false, 'error' => 'No PIN set']);
                exit;
            }
            
            if (!password_verify($input['pin'], $user['pin_hash'])) {
                echo json_encode(['success' => false, 'error' => 'Incorrect PIN']);
                exit;
            }
        }
        
        // Return user with timestamps (last_login and created_at)
        echo json_encode(['success' => true, 'user' => $user]);
        
    } catch (Exception $e) {
        error_log("API error: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>
