require 'webrick'
require 'json'
require 'securerandom'
require 'base64'

# Dịch vụ Giỏ hàng bằng Ruby
# Cổng chạy: 5006

PORT = 5006

# Thử nạp thư viện kết nối SQL Server (TinyTDS)
# Nếu chưa cài, hệ thống sẽ sử dụng cơ chế lưu trữ JSON dự phòng để đảm bảo ứng dụng không bị crash khi chạy thử.
USE_SQL_SERVER = false
begin
  require 'tiny_tds'
  # Cấu hình kết nối SQL Server
  DB_CLIENT = TinyTds::Client.new(
    dataserver: 'localhost',
    database: 'FishDB',
    integrated_security: true # Windows Authentication
  )
  puts "✅ Ruby Cart Service: Connected to SQL Server successfully!"
  USE_SQL_SERVER = true
rescue LoadError
  puts "⚠️ Ruby Cart Service: TinyTds gem not found. Falling back to local JSON database (carts.json)..."
  JSON_DB_PATH = File.join(File.dirname(__FILE__), 'carts.json')
  
  # Tạo file JSON giả lập DB nếu chưa tồn tại
  unless File.exist?(JSON_DB_PATH)
    File.write(JSON_DB_PATH, { "carts" => {}, "cart_items" => {} }.to_json)
  end
end

class CartServlet < WEBrick::HTTPServlet::AbstractServlet
  
  # Giải mã JWT Token để lấy UserId
  def get_user_id(request)
    auth_header = request['Authorization'] || request['authorization']
    if auth_header.nil? || !auth_header.start_with?('Bearer ')
      raise "Unauthorized: Missing token"
    end
    token = auth_header.split(' ')[1]
    payload_b64 = token.split('.')[1]
    
    # Giải mã base64url
    padded_b64 = payload_b64 + '=' * (4 - payload_b64.length % 4)
    decoded_json = Base64.decode64(padded_b64.tr('-', '+').tr('_', '/'))
    user_data = JSON.parse(decoded_json)
    
    # Log các keys nhận được để tiện gỡ lỗi nếu cần
    puts "Ruby Cart Service [Auth]: Decoded JWT claims keys: #{user_data.keys.inspect}"
    
    # Lấy UserId từ các key phổ biến
    user_id = user_data['sub'] || 
              user_data['id'] || 
              user_data['nameid'] || 
              user_data['unique_name'] || 
              user_data['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
              user_data['userId'] || 
              user_data['UserId']
              
    if user_id.nil?
      raise "Unauthorized: UserId not found in token. Available keys: #{user_data.keys.inspect}"
    end
    user_id
  end

  def do_OPTIONS(request, response)
    set_cors_headers(response)
    response.status = 200
  end

  # GET /api/cart - Lấy giỏ hàng
  def do_GET(request, response)
    set_cors_headers(response)
    begin
      user_id = get_user_id(request)
      cart_data = fetch_cart(user_id)
      
      response.status = 200
      response.body = cart_data.to_json
    rescue => e
      response.status = 401
      response.body = { message: e.message }.to_json
    end
  end

  # POST /api/cart/items - Thêm sản phẩm vào giỏ
  def do_POST(request, response)
    set_cors_headers(response)
    begin
      user_id = get_user_id(request)
      body = JSON.parse(request.body)
      product_id = body['productId']
      quantity = body['quantity'] || 1
      selected_gender = body['selectedGender']

      if product_id.nil?
        response.status = 400
        response.body = { message: "ProductId is required" }.to_json
        return
      end

      cart_data = add_to_cart(user_id, product_id, quantity, selected_gender)
      
      response.status = 200
      response.body = cart_data.to_json
    rescue => e
      response.status = 400
      response.body = { message: e.message }.to_json
    end
  end

  # PUT /api/cart/items/:itemId - Cập nhật số lượng
  def do_PUT(request, response)
    set_cors_headers(response)
    begin
      user_id = get_user_id(request)
      # Phân tích Id từ Path /api/cart/items/12
      path_parts = request.path.split('/')
      item_id = path_parts.last.to_i
      
      body = JSON.parse(request.body)
      quantity = body['quantity']

      if quantity.nil? || quantity < 1
        response.status = 400
        response.body = { message: "Invalid quantity" }.to_json
        return
      end

      cart_data = update_item(user_id, item_id, quantity)
      
      response.status = 200
      response.body = cart_data.to_json
    rescue => e
      response.status = 400
      response.body = { message: e.message }.to_json
    end
  end

  # DELETE /api/cart/items/:itemId hoặc DELETE /api/cart
  def do_DELETE(request, response)
    set_cors_headers(response)
    begin
      user_id = get_user_id(request)
      path_parts = request.path.split('/')
      
      if path_parts.last == 'cart'
        # Xóa toàn bộ giỏ hàng
        clear_cart(user_id)
        response.status = 200
        response.body = { message: "Cart cleared" }.to_json
      else
        # Xóa 1 sản phẩm khỏi giỏ hàng
        item_id = path_parts.last.to_i
        cart_data = remove_item(user_id, item_id)
        response.status = 200
        response.body = cart_data.to_json
      end
    rescue => e
      response.status = 400
      response.body = { message: e.message }.to_json
    end
  end

  private

  def set_cors_headers(response)
    response['Content-Type'] = 'application/json; charset=utf-8'
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  end

  # ===== LOGIC TRUY VẤN CƠ SỞ DỮ LIỆU =====
  
  def fetch_cart(user_id)
    if USE_SQL_SERVER
      # Truy vấn bằng SQL Server
      # 1. Tìm hoặc tạo Cart
      cart_result = DB_CLIENT.execute("SELECT Id FROM Carts WHERE UserId = '#{user_id}'").each
      if cart_result.empty?
        DB_CLIENT.execute("INSERT INTO Carts (UserId) VALUES ('#{user_id}')")
        cart_id = DB_CLIENT.execute("SELECT @@IDENTITY AS id").each.first['id'].to_i
      else
        cart_id = cart_result.first['Id'].to_i
      end

      # 2. Lấy danh sách item
      items = []
      total_amount = 0
      total_items = 0

      query = "SELECT ci.Id, ci.ProductId, p.Name as ProductName, p.Price, p.PairPrice, ci.Quantity, ci.SelectedGender, p.ImageUrl, p.Stock, p.MaleStock, p.FemaleStock, p.PhMin, p.PhMax, p.TempMin, p.TempMax, p.Compatibility 
               FROM CartItems ci 
               JOIN Products p ON ci.ProductId = p.Id 
               WHERE ci.CartId = #{cart_id}"

      DB_CLIENT.execute(query).each do |row|
        price = row['Price'].to_f
        if row['SelectedGender'] == 'Cặp'
          price = row['PairPrice'] ? row['PairPrice'].to_f : price * 2
        end

        subtotal = price * row['Quantity'].to_i
        total_amount += subtotal
        total_items += row['Quantity'].to_i

        items << {
          id: row['Id'].to_i,
          productId: row['ProductId'].to_i,
          productName: row['ProductName'],
          price: price,
          quantity: row['Quantity'].to_i,
          availableStock: row['Stock'].to_i,
          imageUrl: row['ImageUrl'],
          selectedGender: row['SelectedGender'],
          phMin: row['PhMin'] ? row['PhMin'].to_f : nil,
          phMax: row['PhMax'] ? row['PhMax'].to_f : nil,
          tempMin: row['TempMin'] ? row['TempMin'].to_f : nil,
          tempMax: row['TempMax'] ? row['TempMax'].to_f : nil,
          compatibility: row['Compatibility']
        }
      end

      return {
        cartId: cart_id,
        userId: user_id,
        items: items,
        totalAmount: total_amount,
        totalItems: total_items
      }
    else
      # Dùng file JSON dự phòng (Đảm bảo chạy được ngay lập tức)
      data = JSON.parse(File.read(JSON_DB_PATH))
      cart_id = data['carts'][user_id]
      if cart_id.nil?
        cart_id = SecureRandom.uuid
        data['carts'][user_id] = cart_id
        File.write(JSON_DB_PATH, data.to_json)
      end

      items = data['cart_items'][cart_id] || []
      
      # Mock thêm thông tin pH/Nhiệt độ cho Neon (Id: 1) và La Hán (Id: 3) để test giỏ hàng tương thích
      items.each do |item|
        if item['productId'] == 1
          item['phMin'] = 5.5
          item['phMax'] = 7.0
          item['tempMin'] = 22.0
          item['tempMax'] = 26.0
          item['compatibility'] = 'Hiền lành'
        elsif item['productId'] == 3
          item['phMin'] = 7.4
          item['phMax'] = 8.0
          item['tempMin'] = 28.0
          item['tempMax'] = 32.0
          item['compatibility'] = 'Rất hung dữ'
        elsif item['productId'] == 11
          item['phMin'] = 6.5
          item['phMax'] = 7.5
          item['tempMin'] = 22.0
          item['tempMax'] = 28.0
          item['compatibility'] = 'Hiền lành'
        end
      end

      total_amount = items.sum { |i| i['price'] * i['quantity'] }
      total_items = items.sum { |i| i['quantity'] }

      return {
        cartId: 999,
        userId: user_id,
        items: items,
        totalAmount: total_amount,
        totalItems: total_items
      }
    end
  end

  def validate_stock_and_gender(product_id, selected_gender, requested_quantity)
    return unless USE_SQL_SERVER
    product = DB_CLIENT.execute("SELECT Stock, MaleStock, FemaleStock FROM Products WHERE Id = #{product_id}").first
    if product.nil?
      raise "Sản phẩm không tồn tại"
    end

    male_stock = product['MaleStock'].to_i
    female_stock = product['FemaleStock'].to_i
    normal_stock = product['Stock'].to_i

    is_gender_product = male_stock > 0 || female_stock > 0

    if is_gender_product
      if selected_gender.nil? || selected_gender.to_s.strip.empty?
        raise "Vui lòng chọn giới tính cho sản phẩm này"
      end

      available = case selected_gender
                  when 'Đực' then male_stock
                  when 'Cái' then female_stock
                  when 'Cặp' then [male_stock, female_stock].min
                  else 0
                  end

      if available < requested_quantity
        unit = selected_gender == 'Cặp' ? 'cặp' : "con #{selected_gender.downcase}"
        raise "Chỉ còn #{available} #{unit} trong kho"
      end
    else
      if normal_stock < requested_quantity
        raise "Số lượng vượt quá tồn kho (Chỉ còn #{normal_stock} sản phẩm)"
      end
    end
  end

  def add_to_cart(user_id, product_id, quantity, selected_gender)
    if USE_SQL_SERVER
      cart = fetch_cart(user_id)
      cart_id = cart[:cartId]

      # Kiểm tra sản phẩm đã có trong giỏ chưa
      gender_cond = selected_gender.nil? ? "SelectedGender IS NULL" : "SelectedGender = '#{selected_gender}'"
      exists = DB_CLIENT.execute("SELECT Id, Quantity FROM CartItems WHERE CartId = #{cart_id} AND ProductId = #{product_id} AND #{gender_cond}").each
      
      current_qty = exists.empty? ? 0 : exists.first['Quantity'].to_i
      total_requested = current_qty + quantity
      
      # Kiểm tra tồn kho trước khi thêm
      validate_stock_and_gender(product_id, selected_gender, total_requested)

      if exists.empty?
        # Thêm mới
        gender_val = selected_gender.nil? ? "NULL" : "'#{selected_gender}'"
        DB_CLIENT.execute("INSERT INTO CartItems (CartId, ProductId, Quantity, SelectedGender) VALUES (#{cart_id}, #{product_id}, #{quantity}, #{gender_val})")
      else
        # Cập nhật số lượng cộng thêm
        DB_CLIENT.execute("UPDATE CartItems SET Quantity = #{total_requested} WHERE Id = #{exists.first['Id']}")
      end
    else
      # JSON fallback
      data = JSON.parse(File.read(JSON_DB_PATH))
      cart_id = data['carts'][user_id]
      data['cart_items'][cart_id] ||= []
      
      # Thử tìm xem trùng sản phẩm & giới tính chưa
      exists = data['cart_items'][cart_id].find { |i| i['productId'] == product_id && i['selectedGender'] == selected_gender }
      if exists
        exists['quantity'] += quantity
      else
        # Mock lấy thông tin cơ bản của cá
        price = 15000 # mặc định
        name = "Cá cảnh thủy sinh"
        image = ""
        if product_id == 1
          name = "Cá Neon Tetra (Size M)"
          price = 15000
          image = "https://bizweb.dktcdn.net/100/441/675/products/neon-tetra-bred-jpg-v-1623742471493.jpg?v=1773116727353"
        elsif product_id == 3
          name = "Cá La Hán Khơ Đỏ"
          price = 1800000
          image = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcST91u_1wfDWcqztp-jyNzRRAr3_Nzx6o50Qg&s"
        elsif product_id == 11
          name = "Cá Bảy Màu (Guppy)"
          price = 15000
          image = "https://file.hstatic.net/200000573099/file/thiet_ke_chua_co_ten__35__0b02d46a60a64877bd03142a36f2eda3_grande.png"
        end

        data['cart_items'][cart_id] << {
          'id' => rand(1000..9999),
          'productId' => product_id,
          'productName' => name,
          'price' => price,
          'quantity' => quantity,
          'imageUrl' => image,
          'selectedGender' => selected_gender
        }
      end
      File.write(JSON_DB_PATH, data.to_json)
    end
    
    fetch_cart(user_id)
  end

  def update_item(user_id, item_id, quantity)
    if USE_SQL_SERVER
      item_info = DB_CLIENT.execute("SELECT ProductId, SelectedGender FROM CartItems WHERE Id = #{item_id}").first
      if item_info
        validate_stock_and_gender(item_info['ProductId'].to_i, item_info['SelectedGender'], quantity)
        DB_CLIENT.execute("UPDATE CartItems SET Quantity = #{quantity} WHERE Id = #{item_id}")
      else
        raise "Sản phẩm không tồn tại trong giỏ"
      end
    else
      data = JSON.parse(File.read(JSON_DB_PATH))
      cart_id = data['carts'][user_id]
      item = data['cart_items'][cart_id]&.find { |i| i['id'] == item_id }
      if item
        item['quantity'] = quantity
        File.write(JSON_DB_PATH, data.to_json)
      end
    end
    fetch_cart(user_id)
  end

  def remove_item(user_id, item_id)
    if USE_SQL_SERVER
      DB_CLIENT.execute("DELETE FROM CartItems WHERE Id = #{item_id}")
    else
      data = JSON.parse(File.read(JSON_DB_PATH))
      cart_id = data['carts'][user_id]
      data['cart_items'][cart_id]&.delete_if { |i| i['id'] == item_id }
      File.write(JSON_DB_PATH, data.to_json)
    end
    fetch_cart(user_id)
  end

  def clear_cart(user_id)
    if USE_SQL_SERVER
      cart = fetch_cart(user_id)
      DB_CLIENT.execute("DELETE FROM CartItems WHERE CartId = #{cart[:cartId]}")
    else
      data = JSON.parse(File.read(JSON_DB_PATH))
      cart_id = data['carts'][user_id]
      data['cart_items'][cart_id] = []
      File.write(JSON_DB_PATH, data.to_json)
    end
  end
end

server = WEBrick::HTTPServer.new(Port: PORT)
server.mount '/api/cart', CartServlet

trap('INT') { server.shutdown }
puts "🚀 Ruby Cart Service is running on http://localhost:#{PORT}/api/cart"
server.start
