import os
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# 設定資料庫 (適配 Zeabur PostgreSQL 與本地 SQLite)
database_url = os.environ.get('DATABASE_URL', 'sqlite:///diary.db')
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- 資料庫模型 ---

class ItineraryItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    day = db.Column(db.String(10), nullable=False)
    time_range = db.Column(db.String(50))
    title = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    map_link = db.Column(db.String(200))
    
    def to_dict(self):
        return {
            'id': self.id,
            'day': self.day,
            'time_range': self.time_range,
            'title': self.title,
            'details': self.details,
            'map_link': self.map_link
        }

class FoodItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    description = db.Column(db.Text)
    link = db.Column(db.String(200))
    is_favorite = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'link': self.link,
            'is_favorite': self.is_favorite
        }

class PrepItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    is_checked = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'name': self.name,
            'is_checked': self.is_checked
        }

# --- 資料填充 (Seed) ---
def seed_data():
    # 1. 補行程
    if not ItineraryItem.query.first():
        print("正在補入行程資料...")
        itineraries = [
            ItineraryItem(day='day1', time_range='09:00 - 11:30', title='啟程', details='從出發地前往東港漁港。建議搭乘 11:30 前的船班。', map_link='https://www.google.com/maps/search/?api=1&query=東港漁港'),
            ItineraryItem(day='day1', time_range='12:00 - 13:30', title='登島與午餐', details='抵達白沙尾碼頭 → 領機車 → 在碼頭附近享用在地午餐 (如：相思麵)。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球白沙尾碼頭'),
            ItineraryItem(day='day1', time_range='13:30 - 14:30', title='Check-in 與採買', details='抵達「老船長民宿」Check-in → 騎車至琉球市區採買火鍋食材。', map_link='https://www.google.com/maps/search/?api=1&query=929屏東縣琉球鄉相埔路87-7號'),
            ItineraryItem(day='day1', time_range='14:30 - 18:00', title='🌊 彈性水上活動 (首選)', details='【黃金時段 15:00-18:00】 浮潛 (看海龜) / 深潛 或 SUP 立槳 (可報名夕陽團)。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球+浮潛'),
            ItineraryItem(day='day1', time_range='18:30 - 21:00', title='🏠 歡樂火鍋夜', details='在民宿煮火鍋、聚餐。', map_link=''),
            ItineraryItem(day='day1', time_range='21:00 - 23:00', title='唱歌與娛樂', details='飯後在民宿公共空間唱歌或玩桌遊。', map_link=''),
            ItineraryItem(day='day2', time_range='08:00 - 10:30', title='🌊 彈性水上活動 (備案)', details='【黃金時段 08:00-11:00】 浮潛/深潛 或 透明獨木舟。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球+透明獨木舟'),
            ItineraryItem(day='day2', time_range='10:30 - 12:30', title='午餐與機動調整', details='享用午餐。若 Day 2 上午水活，午餐後開始環島。', map_link=''),
            ItineraryItem(day='day2', time_range='12:30 - 16:30', title='🛵 北部精華環島', details='景點順序：花瓶岩 → 美人洞 → 山豬溝 → 白燈塔。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球花瓶岩'),
            ItineraryItem(day='day2', time_range='16:30 - 17:45', title='🌅 落日亭賞夕陽', details='前往落日亭觀賞夕陽。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球落日亭'),
            ItineraryItem(day='day2', time_range='18:30 - 20:30', title='晚餐 (海鮮熱炒)', details='在琉球大街或中澳沙灘附近享用海鮮熱炒。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球+琉球番'),
            ItineraryItem(day='day3', time_range='05:45 - 07:00', title='🌄 旭日亭看日出', details='早起挑戰！一月日出約在 06:40 左右。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球旭日亭'),
            ItineraryItem(day='day3', time_range='09:00 - 11:30', title='潮間帶探索', details='需配合當日潮汐時間預約導覽 (重要！)。地點：杉福、肚仔坪。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球杉福潮間帶'),
            ItineraryItem(day='day3', time_range='11:30 - 13:00', title='午餐與休息', details='享用當地特色午餐。', map_link=''),
            ItineraryItem(day='day3', time_range='13:00 - 16:00', title='📸 南部景點與網美時光', details='烏鬼洞 → 厚石群礁 → 網美老木。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球烏鬼洞'),
            ItineraryItem(day='day3', time_range='18:30 - 20:30', title='晚餐 (小島最後一夜)', details='享受小島的最後一晚，可嘗試 BBQ 吃到飽。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球+BBQ'),
            ItineraryItem(day='day3', time_range='20:30 - 22:00', title='夜間生態導覽', details='參加民宿或業者提供的夜遊活動，尋找陸蟹、觀星。', map_link=''),
            ItineraryItem(day='day4', time_range='08:00 - 09:00', title='早餐', details='享用在小琉球的最後一頓早餐。', map_link=''),
            ItineraryItem(day='day4', time_range='09:00 - 11:00', title='採買伴手禮與 Check-out', details='在琉球大街採買伴手禮 → 回民宿整理行李、退房。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球+麻花捲'),
            ItineraryItem(day='day4', time_range='11:30 - 12:00', title='搭船離島', details='歸還機車 → 白沙尾碼頭搭船 → 東港。', map_link='https://www.google.com/maps/search/?api=1&query=小琉球白沙尾碼頭'),
            ItineraryItem(day='day4', time_range='12:30 - 賦歸', title='東港午餐與返程', details='華僑市場午餐或直接返程。', map_link='https://www.google.com/maps/search/?api=1&query=東港華僑市場')
        ]
        db.session.add_all(itineraries)
        db.session.commit()

    # 2. 補美食
    if not FoodItem.query.first():
        print("正在補入美食資料...")
        foods = [
            FoodItem(name='大福羊肉海鮮店', category='seafood', description='招牌羊肉爐、各式海鮮熱炒，在地人也推薦。', link='https://www.google.com/maps/search/?api=1&query=小琉球+大福羊肉海鮮店'),
            FoodItem(name='琉球番壽司', category='seafood', description='想吃日式料理的好選擇，提供新鮮生魚片與創意壽司。', link='https://www.google.com/maps/search/?api=1&query=小琉球+琉球番壽司'),
            FoodItem(name='相思麵', category='snack', description='古早味柴燒麵食，便宜大碗，是午餐的好選擇。', link='https://www.google.com/maps/search/?api=1&query=小琉球+相思麵'),
            FoodItem(name='洪媽媽早餐店', category='snack', description='小琉球最知名的早餐店，必吃琉球粿、賓士包、蔥油條。', link='https://www.google.com/maps/search/?api=1&query=小琉球+洪媽媽早餐店'),
            FoodItem(name='小琉球脆皮蛋餅', category='snack', description='口感獨特的脆皮蛋餅，有多種口味可選，適合當點心。', link='https://www.google.com/maps/search/?api=1&query=小琉球脆皮蛋餅'),
            FoodItem(name='冰箱冰舖', category='dessert', description='知名的網美冰店，招牌是芒果雪花冰和海龜造型冰。', link='https://www.google.com/maps/search/?api=1&query=小琉球+冰箱冰舖'),
            FoodItem(name='小本愛玉', category='dessert', description='主打天然手洗愛玉，海龜造型的愛玉凍超級可愛。', link='https://www.google.com/maps/search/?api=1&query=小琉球+小本愛玉'),
            FoodItem(name='創12分層飲料', category='dessert', description='漸層飲料打卡聖地，好喝又好拍，適合環島時來一杯。', link='https://www.google.com/maps/search/?api=1&query=小琉球+創12')
        ]
        db.session.add_all(foods)
        db.session.commit()

    # 3. 補行前準備
    if not PrepItem.query.first():
        print("正在補入行前準備清單...")
        preps = [
            PrepItem(category='doc', name='身份證 / 健保卡'),
            PrepItem(category='doc', name='機車駕照 (正本)'),
            PrepItem(category='doc', name='現金 (小島店家多收現)'),
            PrepItem(category='doc', name='船票訂位證明 / 民宿地址'),
            PrepItem(category='water', name='泳衣 / 泳褲'),
            PrepItem(category='water', name='蛙鏡 / 呼吸管'),
            PrepItem(category='water', name='蛙鞋 (腳蹼)'),
            PrepItem(category='water', name='礁石鞋 / 膠鞋'),
            PrepItem(category='water', name='浴巾 / 毛巾'),
            PrepItem(category='water', name='防水袋 / 乾濕分離袋'),
            PrepItem(category='water', name='游泳圈 / 浮具'),
            PrepItem(category='water', name='環保防曬乳'),
            PrepItem(category='wear', name='換洗衣物 (短袖/短褲)'),
            PrepItem(category='wear', name='襪子 / 內衣褲'),
            PrepItem(category='wear', name='保暖外套 / 防風外套'),
            PrepItem(category='wear', name='拖鞋 / 涼鞋'),
            PrepItem(category='wear', name='防曬袖套'),
            PrepItem(category='wear', name='太陽眼鏡 / 帽子'),
            PrepItem(category='other', name='充電器 / 行動電源'),
            PrepItem(category='other', name='小型醫藥包'),
            PrepItem(category='other', name='暈船藥'),
            PrepItem(category='other', name='防蚊液'),
            PrepItem(category='other', name='輕便手電筒')
        ]
        db.session.add_all(preps)
        db.session.commit()

# --- 路由 (Routes) ---

@app.route('/')
def index():
    return render_template('index.html')

# 1. 行程 API
@app.route('/api/itinerary', methods=['GET'])
def get_itinerary():
    items = ItineraryItem.query.order_by(ItineraryItem.day, ItineraryItem.time_range).all()
    return jsonify([item.to_dict() for item in items])

@app.route('/api/itinerary', methods=['POST'])
def add_itinerary():
    data = request.get_json()
    new_item = ItineraryItem(
        day=data['day'],
        time_range=data.get('time_range', ''),
        title=data['title'],
        details=data.get('details', ''),
        map_link=data.get('map_link', '')
    )
    db.session.add(new_item)
    db.session.commit()
    return jsonify(new_item.to_dict()), 201

@app.route('/api/itinerary/<int:id>', methods=['PUT'])
def update_itinerary(id):
    item = ItineraryItem.query.get_or_404(id)
    data = request.get_json()
    item.title = data.get('title', item.title)
    item.details = data.get('details', item.details)
    item.time_range = data.get('time_range', item.time_range)
    item.map_link = data.get('map_link', item.map_link)
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/itinerary/<int:id>', methods=['DELETE'])
def delete_itinerary(id):
    item = ItineraryItem.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Deleted successfully'})

# 2. 美食 API (新增 CRUD)
@app.route('/api/foods', methods=['GET'])
def get_foods():
    # ID 倒序，新加的在前面
    items = FoodItem.query.order_by(FoodItem.id.desc()).all()
    return jsonify([item.to_dict() for item in items])

@app.route('/api/foods', methods=['POST'])
def add_food():
    data = request.get_json()
    new_item = FoodItem(
        name=data['name'],
        category=data['category'],
        description=data.get('description', ''),
        link=data.get('link', ''),
        is_favorite=False
    )
    db.session.add(new_item)
    db.session.commit()
    return jsonify(new_item.to_dict()), 201

@app.route('/api/foods/<int:id>', methods=['PUT'])
def update_food(id):
    item = FoodItem.query.get_or_404(id)
    data = request.get_json()
    # 支援更新內容或切換愛心
    if 'name' in data: item.name = data['name']
    if 'category' in data: item.category = data['category']
    if 'description' in data: item.description = data['description']
    if 'link' in data: item.link = data['link']
    if 'is_favorite' in data: item.is_favorite = data['is_favorite']
    
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/foods/<int:id>', methods=['DELETE'])
def delete_food(id):
    item = FoodItem.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Deleted successfully'})

# 3. 行前準備 API
@app.route('/api/prep', methods=['GET'])
def get_prep():
    items = PrepItem.query.all()
    return jsonify([item.to_dict() for item in items])

@app.route('/api/prep', methods=['POST'])
def add_prep():
    data = request.get_json()
    new_item = PrepItem(
        category=data['category'],
        name=data['name'],
        is_checked=False
    )
    db.session.add(new_item)
    db.session.commit()
    return jsonify(new_item.to_dict()), 201

@app.route('/api/prep/<int:id>', methods=['PUT'])
def update_prep(id):
    item = PrepItem.query.get_or_404(id)
    data = request.get_json()
    if 'is_checked' in data: item.is_checked = data['is_checked']
    if 'name' in data: item.name = data['name']
    if 'category' in data: item.category = data['category']
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/prep/<int:id>', methods=['DELETE'])
def delete_prep(id):
    item = PrepItem.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Deleted successfully'})

with app.app_context():
    db.create_all()
    seed_data()

if __name__ == '__main__':
    app.run(debug=True, port=5000)