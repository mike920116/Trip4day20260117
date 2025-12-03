import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# ==========================================
# 資料庫連線設定
# ==========================================

# 1. 嘗試取得環境變數中的連線字串
database_url = os.environ.get('DATABASE_URL')

# 2. 如果沒有 DATABASE_URL，嘗試從 Zeabur 的 MySQL 變數組裝
if not database_url:
    db_host = os.environ.get('MYSQL_HOST')
    db_user = os.environ.get('MYSQL_USER') or os.environ.get('MYSQL_USERNAME')
    db_password = os.environ.get('MYSQL_PASSWORD')
    db_port = os.environ.get('MYSQL_PORT')
    db_name = os.environ.get('MYSQL_DATABASE')

    if db_host and db_user and db_password:
        database_url = f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    else:
        # 本地開發預設 (請自行確認密碼)
        database_url = 'mysql+pymysql://root:NTUB@localhost:3306/travel_db'

# 3. 針對 Zeabur PostgreSQL 的相容性修正
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ==========================================
# 資料庫模型 (Models)
# ==========================================

# 1. 變更紀錄表
class ChangeLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    table_name = db.Column(db.String(50), nullable=False)
    action_type = db.Column(db.String(20), nullable=False) # CREATE, UPDATE, DELETE
    target_id = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)

# 2. 行程表
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

# 3. 美食表
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

# 4. 準備清單表
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

# 5. 全域設定表 (預算)
class TripSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.String(100), nullable=False)

# 6. 活動選項表 (新團的標題，例如：SUP、浮潛)
class ActivityOption(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

# 7. 活動投票表 (報名的人)
class ActivityVote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    option_id = db.Column(db.Integer, db.ForeignKey('activity_option.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    count = db.Column(db.Integer, default=1)

    def to_dict(self):
        return {
            'id': self.id,
            'option_id': self.option_id,
            'name': self.name,
            'count': self.count
        }

# --- 輔助函式：寫入變更紀錄 ---
def log_change(table, action, target_id, desc):
    new_log = ChangeLog(
        table_name=table,
        action_type=action,
        target_id=target_id,
        description=desc
    )
    db.session.add(new_log)

# --- 資料填充 (Seed) ---
def seed_data():
    # 初始化預設的活動選項
    if not ActivityOption.query.first():
        defaults = ['🐢 浮潛 (看海龜)', '🏄 SUP 立槳', '🤿 體驗深潛', '🛶 透明獨木舟']
        for name in defaults:
            db.session.add(ActivityOption(name=name))
        db.session.commit()
        print("已初始化預設水上活動選項")
    
    # 這裡僅保留「如果完全沒資料才寫入」的邏輯
    if ItineraryItem.query.first():
        return 

# ==========================================
# API 路由 (Routes)
# ==========================================

@app.route('/')
def index():
    return render_template('index.html')

# --- 1. 行程 API ---
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
    db.session.flush()
    log_change('itinerary', 'CREATE', new_item.id, f"新增行程: {new_item.title}")
    db.session.commit()
    return jsonify(new_item.to_dict()), 201

@app.route('/api/itinerary/<int:id>', methods=['PUT'])
def update_itinerary(id):
    item = ItineraryItem.query.get_or_404(id)
    data = request.get_json()
    original_title = item.title
    item.title = data.get('title', item.title)
    item.details = data.get('details', item.details)
    item.time_range = data.get('time_range', item.time_range)
    item.map_link = data.get('map_link', item.map_link)
    log_change('itinerary', 'UPDATE', id, f"修改行程: {original_title} -> {item.title}")
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/itinerary/<int:id>', methods=['DELETE'])
def delete_itinerary(id):
    item = ItineraryItem.query.get_or_404(id)
    del_title = item.title
    db.session.delete(item)
    log_change('itinerary', 'DELETE', id, f"刪除行程: {del_title}")
    db.session.commit()
    return jsonify({'message': 'Deleted successfully'})

# --- 2. 美食 API ---
@app.route('/api/foods', methods=['GET'])
def get_foods():
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
    db.session.flush()
    log_change('food', 'CREATE', new_item.id, f"新增美食: {new_item.name}")
    db.session.commit()
    return jsonify(new_item.to_dict()), 201

@app.route('/api/foods/<int:id>', methods=['PUT'])
def update_food(id):
    item = FoodItem.query.get_or_404(id)
    data = request.get_json()
    log_msg = f"更新美食: {item.name}"
    if 'name' in data: item.name = data['name']
    if 'category' in data: item.category = data['category']
    if 'description' in data: item.description = data['description']
    if 'link' in data: item.link = data['link']
    if 'is_favorite' in data: 
        item.is_favorite = data['is_favorite']
        log_msg = f"切換美食收藏: {item.name} -> {item.is_favorite}"
    log_change('food', 'UPDATE', id, log_msg)
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/foods/<int:id>', methods=['DELETE'])
def delete_food(id):
    item = FoodItem.query.get_or_404(id)
    del_name = item.name
    db.session.delete(item)
    log_change('food', 'DELETE', id, f"刪除美食: {del_name}")
    db.session.commit()
    return jsonify({'message': 'Deleted successfully'})

# --- 3. 行前準備 API ---
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
    db.session.flush()
    log_change('prep', 'CREATE', new_item.id, f"新增準備項目: {new_item.name}")
    db.session.commit()
    return jsonify(new_item.to_dict()), 201

@app.route('/api/prep/<int:id>', methods=['PUT'])
def update_prep(id):
    item = PrepItem.query.get_or_404(id)
    data = request.get_json()
    log_msg = f"更新準備項目: {item.name}"
    if 'is_checked' in data: 
        item.is_checked = data['is_checked']
        log_msg = f"勾選狀態變更: {item.name} -> {item.is_checked}"
    if 'name' in data: item.name = data['name']
    if 'category' in data: item.category = data['category']
    log_change('prep', 'UPDATE', id, log_msg)
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/prep/<int:id>', methods=['DELETE'])
def delete_prep(id):
    item = PrepItem.query.get_or_404(id)
    del_name = item.name
    db.session.delete(item)
    log_change('prep', 'DELETE', id, f"刪除準備項目: {del_name}")
    db.session.commit()
    return jsonify({'message': 'Deleted successfully'})

# --- 4. 預算 API ---
@app.route('/api/budget', methods=['GET'])
def get_budget():
    setting = TripSetting.query.filter_by(key='budget').first()
    return jsonify({'value': setting.value if setting else '0'})

@app.route('/api/budget', methods=['PUT'])
def update_budget():
    data = request.get_json()
    new_val = str(data.get('value', 0))
    setting = TripSetting.query.filter_by(key='budget').first()
    old_val = '0'
    if setting:
        old_val = setting.value
        setting.value = new_val
    else:
        db.session.add(TripSetting(key='budget', value=new_val))
    log_change('setting', 'UPDATE', 0, f"更新預算: {old_val} -> {new_val}")
    db.session.commit()
    return jsonify({'value': new_val})

# --- 5. 活動揪團 API (New!) ---

@app.route('/api/activities', methods=['GET'])
def get_activities():
    # 取得所有選項
    options = ActivityOption.query.order_by(ActivityOption.created_at).all()
    # 取得所有投票
    votes = ActivityVote.query.all()
    result = []
    for opt in options:
        # 篩選出屬於這個選項的投票
        opt_votes = [v.to_dict() for v in votes if v.option_id == opt.id]
        result.append({
            'id': opt.id,
            'name': opt.name,
            'votes': opt_votes
        })
    return jsonify(result)

@app.route('/api/activities', methods=['POST'])
def add_activity_option():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    
    new_option = ActivityOption(name=name)
    db.session.add(new_option)
    db.session.flush() # 取得 ID
    log_change('activity', 'CREATE', new_option.id, f"發起新團: {name}")
    db.session.commit()
    return jsonify(new_option.to_dict()), 201

@app.route('/api/activities/<int:id>', methods=['DELETE'])
def delete_activity_option(id):
    # 先刪除該活動下的所有投票
    ActivityVote.query.filter_by(option_id=id).delete()
    # 再刪除活動本身
    option = ActivityOption.query.get_or_404(id)
    del_name = option.name
    db.session.delete(option)
    log_change('activity', 'DELETE', id, f"刪除揪團: {del_name}")
    db.session.commit()
    return jsonify({'message': 'Deleted'})

@app.route('/api/votes', methods=['POST'])
def add_vote():
    data = request.get_json()
    new_vote = ActivityVote(
        option_id=data['option_id'],
        name=data['name'],
        count=int(data.get('count', 1))
    )
    db.session.add(new_vote)
    db.session.flush()
    log_change('vote', 'CREATE', new_vote.id, f"揪團報名: {new_vote.name} +{new_vote.count}")
    db.session.commit()
    return jsonify(new_vote.to_dict()), 201

@app.route('/api/votes/<int:id>', methods=['DELETE'])
def delete_vote(id):
    vote = ActivityVote.query.get_or_404(id)
    desc = f"{vote.name} 退出活動 {vote.option_id}"
    db.session.delete(vote)
    log_change('vote', 'DELETE', id, desc)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

# 初始化
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_data()
    app.run(debug=True, port=5000)