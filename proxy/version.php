<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
echo json_encode([
    'version' => '2.4',
    'features' => ['method_override', 'traffic_simulation', 'referer_control', 'ip_forwarding']
]);
