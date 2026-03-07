<?php
// Proxy to local headless browser service (port 3100)
// Accepts JSON POST with: url, proxyCountry, proxySession, userAgent, language

// Keep running even if the edge function drops the HTTP connection (Deno wall clock limit)
ignore_user_abort(true);

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['url'])) {
    http_response_code(400);
    echo json_encode(['error' => 'url is required']);
    exit;
}

$ch = curl_init('http://127.0.0.1:3100/visit');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($input));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if (curl_errno($ch)) {
    error_log('headless.php curl error: ' . curl_error($ch));
}
curl_close($ch);

http_response_code($httpCode ?: 500);
header('Content-Type: application/json');
echo $response ?: json_encode(['error' => 'headless service unavailable']);
