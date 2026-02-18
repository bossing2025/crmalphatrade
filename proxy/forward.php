<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-Target-URL, X-Http-Method, X-Forwarded-For, X-Forwarded-UA, X-Forwarded-Lang, X-Forwarded-Timezone, X-Custom-Referer');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$targetUrl = $_SERVER['HTTP_X_TARGET_URL'] ?? '';
// Debug: log all incoming headers
error_log('forward.php headers: ' . json_encode(getallheaders()));

if (empty($targetUrl)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing X-Target-URL header']);
    exit;
}

$method = $_SERVER['HTTP_X_HTTP_METHOD'] ?? $_SERVER['REQUEST_METHOD'];
$body = file_get_contents('php://input');
$headers = [];

foreach (getallheaders() as $key => $value) {
    $lower = strtolower($key);
    if (in_array($lower, ['host', 'x-target-url', 'x-http-method', 'x-forwarded-for', 'x-forwarded-ua', 'x-forwarded-lang', 'x-forwarded-timezone', 'x-forwarded-user-agent', 'x-forwarded-accept-language', 'x-forwarded-referer', 'x-custom-referer', 'connection', 'accept-encoding'])) continue;
    // Translate X-Api-Key to Api-Key for target APIs that expect it without the X- prefix
    if ($lower === 'x-api-key') {
        $headers[] = "Api-Key: $value";
        continue;
    }
    $headers[] = "$key: $value";
}

// Traffic simulation headers
if (!empty($_SERVER['HTTP_X_FORWARDED_UA'])) {
    $headers[] = "User-Agent: " . $_SERVER['HTTP_X_FORWARDED_UA'];
}
if (!empty($_SERVER['HTTP_X_FORWARDED_LANG'])) {
    $headers[] = "Accept-Language: " . $_SERVER['HTTP_X_FORWARDED_LANG'];
}
if (!empty($_SERVER['HTTP_X_FORWARDED_TIMEZONE'])) {
    $headers[] = "X-Timezone: " . $_SERVER['HTTP_X_FORWARDED_TIMEZONE'];
}
if (!empty($_SERVER['HTTP_X_CUSTOM_REFERER'])) {
    $headers[] = "Referer: " . $_SERVER['HTTP_X_CUSTOM_REFERER'];
}
if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $headers[] = "X-Forwarded-For: " . $_SERVER['HTTP_X_FORWARDED_FOR'];
}

error_log('forward.php outgoing headers to ' . $targetUrl . ': ' . json_encode($headers));
$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

if ($method === 'POST' || $method === 'PUT') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($contentType) {
    header("Content-Type: $contentType");
}
http_response_code($httpCode);
echo $response;
