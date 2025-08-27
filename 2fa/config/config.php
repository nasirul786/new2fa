<?php
$bot_token = $_ENV['BOT_TOKEN'] ?? '8405979807:AAHaebCRh0cEdHm17hYzlu0kflz_PJjKcIs';
$base_url = $_ENV['BASE_URL'] ?? 'https://2fa.tgbro.link';

define('BOT_TOKEN', $bot_token);
define('BASE_URL', $base_url);

if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    error_log("WARNING: BOT_TOKEN not configured properly");
}

// CORS headers for API
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}
?>
