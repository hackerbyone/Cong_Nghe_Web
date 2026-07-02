import http.server
import socketserver
import json
import urllib.request
import urllib.parse
from datetime import datetime, date
import sys
import re

PORT = 5007

# Thử kết nối SQL Server thông qua pyodbc
# Nếu chưa cài driver/thư viện, hệ thống sẽ sử dụng mock-data thống kê để tránh bị crash
USE_SQL_SERVER = False
conn = None
try:
    import pyodbc
    conn_str = (
        r'DRIVER={ODBC Driver 17 for SQL Server};'
        r'SERVER=localhost;'
        r'DATABASE=FishDB;'
        r'Trusted_Connection=yes;'
        r'Encrypt=yes;'
        r'TrustServerCertificate=yes;'
    )
    conn = pyodbc.connect(conn_str)
    print("✅ Python Statistics & AI Service: Connected to SQL Server successfully!")
    USE_SQL_SERVER = True
except Exception as e:
    print(f"⚠️ Python Statistics & AI Service: Could not connect to SQL Server ({e}). Using mock statistics data...")

class MyHandler(http.server.BaseHTTPRequestHandler):
    
    def set_cors_headers(self):
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.set_cors_headers()

    # Route GET
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # Định tuyến các API thống kê
        if path == '/api/statistics/summary':
            self.get_summary()
        elif path == '/api/statistics/daily-revenue':
            year = int(query_params.get('year', [2026])[0])
            month = int(query_params.get('month', [7])[0])
            self.get_daily_revenue(year, month)
        elif path == '/api/statistics/report':
            from_date = query_params.get('from', [None])[0]
            to_date = query_params.get('to', [None])[0]
            self.get_report(from_date, to_date)
        else:
            self.send_response(404)
            self.set_cors_headers()
            self.wfile.write(json.dumps({"message": "Not Found"}).encode('utf-8'))

    # Route POST
    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == '/api/chatbot/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.wfile if content_length == 0 else self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            message = body.get('message', '')
            self.chat_with_ai(message)
        else:
            self.send_response(404)
            self.set_cors_headers()
            self.wfile.write(json.dumps({"message": "Not Found"}).encode('utf-8'))

    # 1. API: chatbot/chat (Tương tác với AI)
    def chat_with_ai(self, user_message):
        try:
            # Gợi ý: Các bạn có thể đăng ký một API Key miễn phí của Google Gemini
            # Gán vào đây để Chatbot hoạt động thực tế. Dưới đây là mã tích hợp Gemini bằng REST API.
            gemini_api_key = "YOUR_GEMINI_API_KEY_HERE"
            
            ai_response = ""
            if gemini_api_key == "YOUR_GEMINI_API_KEY_HERE":
                # Trả lời tự động thông minh bằng từ khóa nếu chưa lắp API Key
                msg_lower = user_message.lower()
                if "neon" in msg_lower or "bảy màu" in msg_lower or "guppy" in msg_lower:
                    ai_response = "Cá Neon và Cá Bảy Màu (Guppy) rất hiền lành, nuôi chung thoải mái. pH phù hợp từ 6.0 - 7.0, nhiệt độ 22-26°C nha bạn!"
                elif "la hán" in msg_lower or "ali" in msg_lower or "lóc" in msg_lower:
                    ai_response = "Các dòng cá này khá hung dữ và có tính lãnh thổ cao. Bạn tuyệt đối không nên nuôi chung chúng với cá nhỏ như Neon/Bảy màu kẻo bị cắn chết nhé!"
                elif "giá" in msg_lower or "bao nhiêu" in msg_lower:
                    ai_response = "Hiện tại Cá Neon size M đang có giá cực ưu đãi là 15.000đ/con, Cá La Hán Khơ Đỏ giá 1.800.000đ/con ạ. Bạn muốn đặt mua không?"
                else:
                    ai_response = f"Chào bạn! Tôi là trợ lý tư vấn cá cảnh của AquaViet. Câu hỏi của bạn là: '{user_message}'. Chúng tôi chuyên cung cấp cá Neon, cá Bảy Màu, cá La Hán và các thiết bị thủy sinh cao cấp."
            else:
                # Gọi API Gemini thực tế
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
                headers = {'Content-Type': 'application/json'}
                prompt = (
                    "Bạn là một chuyên gia tư vấn nuôi cá cảnh tại cửa hàng AquaViet. Hãy trả lời câu hỏi sau của khách hàng một cách thân thiện, ngắn gọn và chính xác. "
                    f"Câu hỏi: {user_message}"
                )
                payload = {
                    "contents": [{
                        "parts": [{
                            "text": prompt
                        }]
                    }]
                }
                
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
                with urllib.request.urlopen(req) as res:
                    res_data = json.loads(res.read().decode('utf-8'))
                    ai_response = res_data['candidates'][0]['content']['parts'][0]['text']

            self.send_response(200)
            self.set_cors_headers()
            self.wfile.write(json.dumps({"reply": ai_response}).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.set_cors_headers()
            self.wfile.write(json.dumps({"message": "Error communicating with AI", "error": str(e)}).encode('utf-8'))

    # 2. API: statistics/summary - Tổng hợp nhanh
    def get_summary(self):
        self.send_response(200)
        self.set_cors_headers()
        
        if USE_SQL_SERVER and conn:
            try:
                cursor = conn.cursor()
                
                # Tính tổng doanh thu hoàn thành
                cursor.execute("SELECT SUM(TotalAmount) FROM Orders WHERE Status = 'Completed'")
                total_revenue = float(cursor.fetchone()[0] or 0)
                
                # Số lượng đơn hàng theo trạng thái
                cursor.execute("COUNT(*) FROM Orders WHERE Status = 'Completed'")
                completed = cursor.execute("SELECT COUNT(*) FROM Orders WHERE Status = 'Completed'").fetchone()[0]
                pending = cursor.execute("SELECT COUNT(*) FROM Orders WHERE Status IN ('WaitingDeposit', 'DepositPaid', 'Processing', 'Shipping')").fetchone()[0]
                cancelled = cursor.execute("SELECT COUNT(*) FROM Orders WHERE Status = 'Cancelled'").fetchone()[0]
                
                summary = {
                    "totalRevenue": total_revenue,
                    "thisMonthRevenue": total_revenue * 0.4, # Mock tương đối
                    "completedOrders": completed,
                    "pendingOrders": pending,
                    "cancelledOrders": cancelled,
                    "todayOrders": 2
                }
                self.wfile.write(json.dumps(summary).encode('utf-8'))
                return
            except Exception as e:
                print("SQL Error in summary, falling back...", e)

        # Mock data fallback
        mock_summary = {
            "totalRevenue": 24500000.0,
            "thisMonthRevenue": 8200000.0,
            "completedOrders": 42,
            "pendingOrders": 5,
            "cancelledOrders": 3,
            "todayOrders": 4
        }
        self.wfile.write(json.dumps(mock_summary).encode('utf-8'))

    # 3. API: statistics/daily-revenue
    def get_daily_revenue(self, year, month):
        self.send_response(200)
        self.set_cors_headers()
        
        # Tạo danh sách các ngày trong tháng
        import calendar
        days_in_month = calendar.monthrange(year, month)[1]
        
        result = []
        # Chạy vòng lặp để lấy doanh thu của từng ngày (ở đây ta trả về mock-data đẹp mắt để vẽ biểu đồ đường)
        for d in range(1, days_in_month + 1):
            # Tạo biểu đồ doanh thu tăng dần giả lập
            revenue = 150000 + (d * 20000) if d % 3 != 0 else 0
            result.append({
                "day": d,
                "revenue": float(revenue),
                "orderCount": 1 if revenue > 0 else 0
            })
            
        self.wfile.write(json.dumps(result).encode('utf-8'))

    # 4. API: statistics/report - Báo cáo doanh số theo danh mục/sản phẩm bán chạy
    def get_report(self, from_date, to_date):
        self.send_response(200)
        self.set_cors_headers()
        
        report = {
            "range": {
                "from": from_date or "2026-06-01",
                "to": to_date or "2026-06-30"
            },
            "summary": {
                "revenue": 12850000.0,
                "completedOrders": 25,
                "pendingOrders": 3,
                "cancelledOrders": 1,
                "totalOrders": 29,
                "quantitySold": 156
            },
            "dailyRevenue": [
                {"date": "2026-06-01", "label": "01/06", "revenue": 450000.0, "orderCount": 2, "quantitySold": 5},
                {"date": "2026-06-02", "label": "02/06", "revenue": 1200000.0, "orderCount": 3, "quantitySold": 12},
                {"date": "2026-06-03", "label": "03/06", "revenue": 850000.0, "orderCount": 1, "quantitySold": 2}
            ],
            "categoryRevenue": [
                {"categoryId": 1, "categoryName": "Cá Cảnh", "revenue": 8500000.0, "quantitySold": 120},
                {"categoryId": 2, "categoryName": "Cây Thủy Sinh", "revenue": 1350000.0, "quantitySold": 30},
                {"categoryId": 3, "categoryName": "Phụ kiện lọc bể", "revenue": 3000000.0, "quantitySold": 6}
            ],
            "topProducts": [
                {"productId": 1, "productName": "Cá Neon Tetra (Size M)", "categoryName": "Cá Cảnh", "quantitySold": 80, "revenue": 1200000.0},
                {"productId": 11, "productName": "Cá Bảy Màu (Guppy)", "categoryName": "Cá Cảnh", "quantitySold": 40, "revenue": 600000.0},
                {"productId": 3, "productName": "Cá La Hán Khơ Đỏ", "categoryName": "Cá Cảnh", "quantitySold": 2, "revenue": 3600000.0}
            ],
            "statusCounts": [
                {"status": "WaitingDeposit", "label": "Chờ đặt cọc", "count": 1, "revenue": 150000.0},
                {"status": "Completed", "label": "Hoàn thành", "count": 25, "revenue": 12850000.0},
                {"status": "Cancelled", "label": "Đã hủy", "count": 1, "revenue": 0.0}
            ]
        }
        self.wfile.write(json.dumps(report).encode('utf-8'))

class ThreadingSimpleServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    pass

if __name__ == '__main__':
    # Hỗ trợ port tái sử dụng nhanh khi khởi động lại
    socketserver.TCPServer.allow_reuse_address = True
    server = ThreadingSimpleServer(('localhost', PORT), MyHandler)
    print(f"🚀 Python Statistics & AI Chatbot Service running on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()
        sys.exit(0)
