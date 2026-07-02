<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';
require_once 'BlogsController.php';

$controller = new BlogsController($pdo, $use_json_fallback, $json_db_path);

// Phân tích URI
// Ví dụ: /api/blogs hoặc /api/blogs/123-abc
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api/blogs';

// Loại bỏ query string (ví dụ: ?page=1)
if (false !== $pos = strpos($requestUri, '?')) {
    $requestUri = substr($requestUri, 0, $pos);
}

$requestMethod = $_SERVER['REQUEST_METHOD'];

// Kiểm tra xem URI có đúng tiền tố /api/blogs không
if (strpos($requestUri, $basePath) !== 0) {
    http_response_code(404);
    echo json_encode(["message" => "Endpoint not found"]);
    exit();
}

// Lấy phần ID phía sau /api/blogs/ (nếu có)
$id = null;
$subPath = substr($requestUri, strlen($basePath));
if (!empty($subPath)) {
    $parts = explode('/', trim($subPath, '/'));
    if (count($parts) > 0 && $parts[0] !== '') {
        $id = $parts[0];
    }
}

// Gọi API thích hợp
switch ($requestMethod) {
    case 'GET':
        if ($id) {
            $controller->getById($id);
        } else {
            $keyword = $_GET['keyword'] ?? null;
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $pageSize = isset($_GET['pageSize']) ? (int)$_GET['pageSize'] : 10;
            $controller->getAll($keyword, $page, $pageSize);
        }
        break;

    case 'POST':
        $controller->create();
        break;

    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Id is required for update"]);
            break;
        }
        $controller->update($id);
        break;

    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Id is required for delete"]);
            break;
        }
        $controller->delete($id);
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method Not Allowed"]);
        break;
}
