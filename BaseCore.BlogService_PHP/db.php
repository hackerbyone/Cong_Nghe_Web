<?php
// Cấu hình Database kết nối tới SQL Server
$host = 'localhost';
$dbname = 'FishDB';

$use_json_fallback = false;
$json_db_path = __DIR__ . '/blogs.json';
$pdo = null;

try {
    // 1. Thử dùng sqlsrv driver (Phổ biến nhất trên Windows)
    $dsn = "sqlsrv:Server=$host;Database=$dbname;Encrypt=true;TrustServerCertificate=true";
    $pdo = new PDO($dsn);
} catch (PDOException $e) {
    try {
        // 2. Thử dùng dblib driver (Dùng trên Linux / Mac với FreeTDS)
        $dsn = "dblib:host=$host;dbname=$dbname";
        $pdo = new PDO($dsn);
    } catch (PDOException $e2) {
        try {
            // 3. Thử dùng ODBC driver
            $dsn = "odbc:Driver={ODBC Driver 17 for SQL Server};Server=$host;Database=$dbname;Encrypt=yes;TrustServerCertificate=yes;";
            $pdo = new PDO($dsn);
        } catch (PDOException $e3) {
            // KHÔNG CÓ DRIVER SQL SERVER: Kích hoạt chế độ JSON dự phòng để chạy thử lập tức
            $use_json_fallback = true;
        }
    }
}

if ($use_json_fallback) {
    // Tự động khởi tạo dữ liệu mẫu nếu chưa có file blogs.json
    if (!file_exists($json_db_path)) {
        $sample_blogs = [
            [
                "Id" => "blog-sample-1",
                "Title" => "Hướng dẫn thay nước và chăm sóc cá Neon Tetra tại nhà",
                "ShortDescription" => "Cá Neon là loài cá cảnh nhạy cảm với chất lượng nước. Bài viết này hướng dẫn bạn cách giữ pH ổn định và thay nước đúng cách.",
                "Content" => "Cá Neon Tetra (cá huỳnh quang) là loài cá sống bầy đàn rất được ưa chuộng. Để chăm sóc chúng tốt nhất, pH nước cần duy trì ở mức 6.0 - 7.0 và nhiệt độ từ 22-26°C. Khi thay nước, chỉ nên thay 20-30% lượng nước trong bể để tránh làm cá sốc nước. Sử dụng dung dịch khử clo trước khi cho nước mới vào.",
                "ImageUrl" => "https://bizweb.dktcdn.net/100/441/675/products/neon-tetra-bred-jpg-v-1623742471493.jpg?v=1773116727353",
                "Author" => "Chuyên gia AquaViet",
                "PublishDate" => date('Y-m-d H:i:s'),
                "IsActive" => 1
            ],
            [
                "Id" => "blog-sample-2",
                "Title" => "Cách xử lý bể cá cảnh bị đục nước nhanh chóng hiệu quả",
                "ShortDescription" => "Nước bể cá bị đục trắng hoặc đục xanh là vấn đề nan giải. Tìm hiểu nguyên nhân và cách xử lý triệt để trong 24h.",
                "Content" => "Hiện tượng đục nước thường do hệ vi sinh chưa ổn định hoặc do thức ăn thừa quá nhiều. Bạn nên bổ sung vi sinh quang hợp, giảm lượng thức ăn cho cá ăn hàng ngày, và lắp đặt một hệ thống lọc treo hoặc lọc tràn chất lượng.",
                "ImageUrl" => "https://aquahouse.vn/wp-content/uploads/2026/03/Loc-treo-Baoyu-LX-280-380-480-giai-phap-tach-phan-va-loc-da-tang-toan-dien.jpg",
                "Author" => "Admin Cửa Hàng",
                "PublishDate" => date('Y-m-d H:i:s'),
                "IsActive" => 1
            ]
        ];
        file_write_contents_safe($json_db_path, $sample_blogs);
    }
} else {
    // Cấu hình chế độ báo lỗi PDO
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
}

function file_write_contents_safe($path, $data) {
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}
