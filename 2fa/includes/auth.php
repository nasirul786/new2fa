<?php
function verifyTelegramWebApp($bot_token, $init_data) {
    parse_str($init_data, $data);
    
    if (!isset($data['hash'])) {
        return ['ok' => false, 'error' => 'No hash provided'];
    }
    
    $hash = $data['hash'];
    unset($data['hash']);
    
    ksort($data);
    $data_check_string = implode("\n", array_map(fn($k, $v) => "$k=$v", array_keys($data), array_values($data)));
    
    $secret_key = hash_hmac('sha256', $bot_token, 'WebAppData', true);
    $calculated_hash = bin2hex(hash_hmac('sha256', $data_check_string, $secret_key, true));
    
    if (isset($data['user']) && is_string($data['user'])) {
        $decoded_user = json_decode($data['user'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $data['user'] = $decoded_user;
        }
    }
    
    return [
        'ok' => hash_equals($hash, $calculated_hash),
        'data' => $data
    ];
}

function authenticateUser($init_data) {
    $verification = verifyTelegramWebApp(BOT_TOKEN, $init_data);
    
    if (!$verification['ok']) {
        return ['success' => false, 'error' => 'Invalid Telegram data'];
    }
    
    $user_data = $verification['data']['user'];
    
    // Get or create user
    $database = new Database();
    $db = $database->getConnection();
    
    $stmt = $db->prepare("SELECT * FROM users WHERE telegram_id = ?");
    $stmt->execute([$user_data['id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        // Create new user
        $stmt = $db->prepare("INSERT INTO users (telegram_id, username, first_name, last_name, language_code) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $user_data['id'],
            $user_data['username'] ?? null,
            $user_data['first_name'] ?? null,
            $user_data['last_name'] ?? null,
            $user_data['language_code'] ?? 'en'
        ]);
        
        $user_id = $db->lastInsertId();
        $user = [
            'id' => $user_id,
            'telegram_id' => $user_data['id'],
            'username' => $user_data['username'] ?? null,
            'first_name' => $user_data['first_name'] ?? null,
            'last_name' => $user_data['last_name'] ?? null,
            'language_code' => $user_data['language_code'] ?? 'en',
            'pin_hash' => null,
            'keep_unlocked' => false
        ];
    } else {
        // Update last login
        $stmt = $db->prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$user['id']]);
    }
    
    return ['success' => true, 'user' => $user];
}
?>
