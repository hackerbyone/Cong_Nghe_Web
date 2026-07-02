<?php

class BlogsController {
    private $db;
    private $use_json;
    private $json_path;

    public function __construct($pdo, $use_json = false, $json_path = '') {
        $this->db = $pdo;
        $this->use_json = $use_json;
        $this->json_path = $json_path;
    }

    // Helper: Chuyển các key từ PascalCase (CSDL) sang camelCase (React Frontend mong muốn)
    private function camelCaseKeys($data) {
        if (!is_array($data)) return $data;
        $result = [];
        foreach ($data as $key => $value) {
            $camelKey = lcfirst($key);
            if (is_array($value)) {
                $result[$camelKey] = $this->camelCaseKeys($value);
            } else {
                // Ép kiểu các trường đặc thù
                if ($key === 'IsActive') {
                    $result[$camelKey] = (bool)$value;
                } else {
                    $result[$camelKey] = $value;
                }
            }
        }
        return $result;
    }

    // Helper: Giải mã JWT token (không cần thư viện ngoài)
    private function getAuthenticatedUser() {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        
        if (empty($authHeader) || strpos($authHeader, 'Bearer ') !== 0) {
            http_response_code(401);
            echo json_encode(["message" => "Unauthorized: Missing or invalid token"]);
            exit();
        }

        $token = substr($authHeader, 7);
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            http_response_code(401);
            echo json_encode(["message" => "Unauthorized: Invalid JWT structure"]);
            exit();
        }

        $payload = base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1]));
        $user = json_decode($payload, true);

        if (!$user) {
            http_response_code(401);
            echo json_encode(["message" => "Unauthorized: Cannot decode user payload"]);
            exit();
        }

        return $user;
    }

    // 1. GET ALL (Phân trang và tìm kiếm)
    public function getAll($keyword, $page, $pageSize) {
        if ($this->use_json) {
            $data = json_decode(file_get_contents($this->json_path), true) ?: [];
            $filtered_blogs = [];

            foreach ($data as $blog) {
                if (empty($keyword)) {
                    $filtered_blogs[] = $blog;
                } else {
                    $k = strtolower($keyword);
                    if (strpos(strtolower($blog['Title']), $k) !== false ||
                        strpos(strtolower($blog['ShortDescription']), $k) !== false ||
                        strpos(strtolower($blog['Content']), $k) !== false) {
                        $filtered_blogs[] = $blog;
                    }
                }
            }

            usort($filtered_blogs, function($a, $b) {
                return strcmp($b['PublishDate'], $a['PublishDate']);
            });

            $totalCount = count($filtered_blogs);
            $offset = ($page - 1) * $pageSize;
            $paginated = array_slice($filtered_blogs, $offset, $pageSize);

            // Chuyển toàn bộ danh sách sang camelCase trước khi trả về
            $formattedItems = [];
            foreach ($paginated as $item) {
                $formattedItems[] = $this->camelCaseKeys($item);
            }

            echo json_encode([
                "items" => $formattedItems,
                "totalCount" => $totalCount,
                "page" => $page,
                "pageSize" => $pageSize,
                "totalPages" => ceil($totalCount / $pageSize)
            ]);
            return;
        }

        try {
            $offset = ($page - 1) * $pageSize;
            $sql = "SELECT * FROM Blogs";
            $countSql = "SELECT COUNT(*) FROM Blogs";
            $params = [];

            if (!empty($keyword)) {
                $sql .= " WHERE Title LIKE :keyword OR ShortDescription LIKE :keyword OR Content LIKE :keyword";
                $countSql .= " WHERE Title LIKE :keyword OR ShortDescription LIKE :keyword OR Content LIKE :keyword";
                $params[':keyword'] = "%$keyword%";
            }

            $countStmt = $this->db->prepare($countSql);
            $countStmt->execute($params);
            $totalCount = (int)$countStmt->fetchColumn();

            $sql .= " ORDER BY PublishDate DESC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY";
            
            $stmt = $this->db->prepare($sql);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->bindValue(':pageSize', $pageSize, PDO::PARAM_INT);
            foreach ($params as $key => $val) {
                $stmt->bindValue($key, $val);
            }
            $stmt->execute();
            $blogs = $stmt->fetchAll();

            $formattedItems = [];
            foreach ($blogs as $blog) {
                $formattedItems[] = $this->camelCaseKeys($blog);
            }

            echo json_encode([
                "items" => $formattedItems,
                "totalCount" => $totalCount,
                "page" => $page,
                "pageSize" => $pageSize,
                "totalPages" => ceil($totalCount / $pageSize)
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error retrieving blogs", "error" => $e->getMessage()]);
        }
    }

    // 2. GET BY ID
    public function getById($id) {
        if ($this->use_json) {
            $data = json_decode(file_get_contents($this->json_path), true) ?: [];
            foreach ($data as $blog) {
                if ($blog['Id'] === $id) {
                    echo json_encode($this->camelCaseKeys($blog));
                    return;
                }
            }
            http_response_code(404);
            echo json_encode(["message" => "Blog not found"]);
            return;
        }

        try {
            $stmt = $this->db->prepare("SELECT * FROM Blogs WHERE Id = :id");
            $stmt->execute([':id' => $id]);
            $blog = $stmt->fetch();

            if (!$blog) {
                http_response_code(404);
                echo json_encode(["message" => "Blog not found"]);
                return;
            }

            echo json_encode($this->camelCaseKeys($blog));
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error retrieving blog", "error" => $e->getMessage()]);
        }
    }

    // 3. CREATE
    public function create() {
        $this->getAuthenticatedUser();

        if ($this->use_json) {
            $data = json_decode(file_get_contents($this->json_path), true) ?: [];
            $input = json_decode(file_get_contents("php://input"), true);
            
            if (empty($input['Title']) || empty($input['Content'])) {
                http_response_code(400);
                echo json_encode(["message" => "Title and Content are required"]);
                return;
            }

            $id = bin2hex(random_bytes(16));
            $new_blog = [
                "Id" => $id,
                "Title" => $input['Title'],
                "ShortDescription" => $input['ShortDescription'] ?? '',
                "Content" => $input['Content'],
                "ImageUrl" => $input['ImageUrl'] ?? '',
                "Author" => $input['Author'] ?? 'Admin',
                "PublishDate" => date('Y-m-d H:i:s'),
                "IsActive" => isset($input['IsActive']) ? (int)$input['IsActive'] : 1
            ];

            $data[] = $new_blog;
            file_put_contents($this->json_path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            http_response_code(201);
            echo json_encode($this->camelCaseKeys($new_blog));
            return;
        }

        try {
            $data = json_decode(file_get_contents("php://input"), true);
            
            if (empty($data['Title']) || empty($data['Content'])) {
                http_response_code(400);
                echo json_encode(["message" => "Title and Content are required"]);
                return;
            }

            $id = bin2hex(random_bytes(16));
            $title = $data['Title'];
            $shortDesc = $data['ShortDescription'] ?? '';
            $content = $data['Content'];
            $imageUrl = $data['ImageUrl'] ?? '';
            $author = $data['Author'] ?? 'Admin';
            $publishDate = date('Y-m-d H:i:s');
            $isActive = isset($data['IsActive']) ? (int)$data['IsActive'] : 1;

            $sql = "INSERT INTO Blogs (Id, Title, ShortDescription, Content, ImageUrl, Author, PublishDate, IsActive) 
                    VALUES (:id, :title, :shortDesc, :content, :imageUrl, :author, :publishDate, :isActive)";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':title' => $title,
                ':shortDesc' => $shortDesc,
                ':content' => $content,
                ':imageUrl' => $imageUrl,
                ':author' => $author,
                ':publishDate' => $publishDate,
                ':isActive' => $isActive
            ]);

            http_response_code(201);
            echo json_encode($this->camelCaseKeys([
                "Id" => $id,
                "Title" => $title,
                "ShortDescription" => $shortDesc,
                "Content" => $content,
                "ImageUrl" => $imageUrl,
                "Author" => $author,
                "PublishDate" => $publishDate,
                "IsActive" => (bool)$isActive
            ]));
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error creating blog", "error" => $e->getMessage()]);
        }
    }

    // 4. UPDATE
    public function update($id) {
        $this->getAuthenticatedUser();

        if ($this->use_json) {
            $data = json_decode(file_get_contents($this->json_path), true) ?: [];
            $found_index = -1;
            
            foreach ($data as $index => $blog) {
                if ($blog['Id'] === $id) {
                    $found_index = $index;
                    break;
                }
            }

            if ($found_index === -1) {
                http_response_code(404);
                echo json_encode(["message" => "Blog not found"]);
                return;
            }

            $input = json_decode(file_get_contents("php://input"), true);
            $blog = &$data[$found_index];

            $blog['Title'] = $input['Title'] ?? $blog['Title'];
            $blog['ShortDescription'] = $input['ShortDescription'] ?? $blog['ShortDescription'];
            $blog['Content'] = $input['Content'] ?? $blog['Content'];
            $blog['ImageUrl'] = $input['ImageUrl'] ?? $blog['ImageUrl'];
            $blog['Author'] = $input['Author'] ?? $blog['Author'];
            if (isset($input['IsActive'])) {
                $blog['IsActive'] = (int)$input['IsActive'];
            }

            file_put_contents($this->json_path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            echo json_encode($this->camelCaseKeys($blog));
            return;
        }

        try {
            $data = json_decode(file_get_contents("php://input"), true);
            
            $stmt = $this->db->prepare("SELECT * FROM Blogs WHERE Id = :id");
            $stmt->execute([':id' => $id]);
            $blog = $stmt->fetch();

            if (!$blog) {
                http_response_code(404);
                echo json_encode(["message" => "Blog not found"]);
                return;
            }

            $title = $data['Title'] ?? $blog['Title'];
            $shortDesc = $data['ShortDescription'] ?? $blog['ShortDescription'];
            $content = $data['Content'] ?? $blog['Content'];
            $imageUrl = $data['ImageUrl'] ?? $blog['ImageUrl'];
            $author = $data['Author'] ?? $blog['Author'];
            $isActive = isset($data['IsActive']) ? (int)$data['IsActive'] : $blog['IsActive'];

            $sql = "UPDATE Blogs SET Title = :title, ShortDescription = :shortDesc, Content = :content, 
                                     ImageUrl = :imageUrl, Author = :author, IsActive = :isActive 
                    WHERE Id = :id";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':title' => $title,
                ':shortDesc' => $shortDesc,
                ':content' => $content,
                ':imageUrl' => $imageUrl,
                ':author' => $author,
                ':isActive' => $isActive
            ]);

            echo json_encode($this->camelCaseKeys([
                "Id" => $id,
                "Title" => $title,
                "ShortDescription" => $shortDesc,
                "Content" => $content,
                "ImageUrl" => $imageUrl,
                "Author" => $author,
                "PublishDate" => $blog['PublishDate'],
                "IsActive" => (bool)$isActive
            ]));
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error updating blog", "error" => $e->getMessage()]);
        }
    }

    // 5. DELETE
    public function delete($id) {
        $this->getAuthenticatedUser();

        if ($this->use_json) {
            $data = json_decode(file_get_contents($this->json_path), true) ?: [];
            $filtered = [];
            $found = false;

            foreach ($data as $blog) {
                if ($blog['Id'] === $id) {
                    $found = true;
                } else {
                    $filtered[] = $blog;
                }
            }

            if (!$found) {
                http_response_code(404);
                echo json_encode(["message" => "Blog not found"]);
                return;
            }

            file_put_contents($this->json_path, json_encode($filtered, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(["message" => "Blog deleted successfully"]);
            return;
        }

        try {
            $stmt = $this->db->prepare("SELECT * FROM Blogs WHERE Id = :id");
            $stmt->execute([':id' => $id]);
            $blog = $stmt->fetch();

            if (!$blog) {
                http_response_code(404);
                echo json_encode(["message" => "Blog not found"]);
                return;
            }

            $deleteStmt = $this->db->prepare("DELETE FROM Blogs WHERE Id = :id");
            $deleteStmt->execute([':id' => $id]);

            echo json_encode(["message" => "Blog deleted successfully"]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error deleting blog", "error" => $e->getMessage()]);
        }
    }
}
