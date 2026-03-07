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
    if (in_array($lower, ['host', 'x-target-url', 'x-http-method', 'x-forwarded-for', 'x-forwarded-ua', 'x-forwarded-lang', 'x-forwarded-timezone', 'x-forwarded-user-agent', 'x-forwarded-accept-language', 'x-forwarded-referer', 'x-custom-referer', 'x-proxy-country', 'x-proxy-session', 'user-agent', 'connection', 'accept-encoding'])) continue;
    // Translate X-Api-Key to Api-Key for target APIs that expect it without the X- prefix
    if ($lower === 'x-api-key') {
        $headers[] = "Api-Key: $value";
        continue;
    }
    $headers[] = "$key: $value";
}

// Traffic simulation headers
// Support both X-Forwarded-User-Agent (full, used by send-injection) and X-Forwarded-UA (short, legacy)
$customUserAgent = $_SERVER['HTTP_X_FORWARDED_USER_AGENT']
    ?? $_SERVER['HTTP_X_FORWARDED_UA']
    ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
curl_setopt($ch, CURLOPT_USERAGENT, $customUserAgent);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// Residential proxy routing (MangoProxy) — used for registration and autologin visits
// X-Proxy-Session enables sticky sessions so both registration and autologin share the same IP
$proxyCountry = strtolower($_SERVER['HTTP_X_PROXY_COUNTRY'] ?? '');
$proxySession = preg_replace('/[^a-z0-9]/', '', strtolower($_SERVER['HTTP_X_PROXY_SESSION'] ?? ''));
if (!empty($proxyCountry)) {
    if (!empty($proxySession)) {
        $proxyUsername = "xylvx6i2utq-zone-custom-region-{$proxyCountry}-session-{$proxySession}-sessTime-15";
    } else {
        $proxyUsername = "xylvx6i2utq-zone-custom-region-{$proxyCountry}";
    }
    $proxyPassword = "pjuanujbxvy7g";
    curl_setopt($ch, CURLOPT_PROXY, 'p3.mangoproxy.com');
    curl_setopt($ch, CURLOPT_PROXYPORT, 2333);
    curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTP);
    curl_setopt($ch, CURLOPT_PROXYUSERPWD, $proxyUsername . ':' . $proxyPassword);
    error_log('forward.php using residential proxy: ' . $proxyUsername);
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($method === 'POST' || $method === 'PUT') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if (curl_errno($ch)) {
    error_log('forward.php curl error: ' . curl_errno($ch) . ' - ' . curl_error($ch));
}
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($contentType) {
    header("Content-Type: $contentType");
}
http_response_code($httpCode);
echo $response;
