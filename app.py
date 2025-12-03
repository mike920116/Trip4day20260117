import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate  # 1. 引入 Migrate

app = Flask(__name__)

# ==========================================
# 資料庫連線設定
# ==========================================

database_url = os.environ.get('DATABASE_URL')

if not database_url:
    db_host = os.environ.get('MYSQL_HOST')
    db_user = os.environ.get('MYSQL_USER') or os.environ.get('MYSQL_USERNAME')
    db_password = os.environ.get('MYSQL_PASSWORD')
    db_port = os.environ.get('MYSQL_PORT')
    db_name = os.environ.get('MYSQL_DATABASE')

    if db_host and db_user and db_password:
        database_url = f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    else:
        # 本地開發預設
        database_url = 'mysql+pymysql://root:NTUB@localhost:3306/travel_db'

if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)  # 2. 初始化 Migrate，讓 Flask 擁有資料庫遷移功能

# ==========================================
# 資料庫模型 (Models)
# ==========================================

class ChangeLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    table_name = db.Column(db.String(50), nullable=False)
    action_type = db.Column(db.String(20), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now)

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

class TripSetting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.String(100), nullable=False)

# 6. 活動選項表 (已加入 cost 欄位)
class ActivityOption(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    cost = db.Column(db.String(50), default="費用未定")
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'cost': self.cost
        }

# 7. 活動投票表
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

def log_change(table, action, target_id, desc):
    new_log = ChangeLog(table_name=table, action_type=action, target_id=target_id, description=desc)
    db.session.add(new_log)

# --- CLI command for seeding data ---
# 3. 將 seed_data 註冊為 Flask 指令，這樣可以用 `flask seed` 執行
@app.cli.command("seed")
def seed_command():
    """Initialize the database with seed data."""
    if not ActivityOption.query.first():
        defaults = ['🐢 浮潛 (看海龜)', '🏄 SUP 立槳', '🤿 體驗深潛', '🛶 透明獨木舟']
        for name in defaults:
            db.session.add(ActivityOption(name=name, cost=0))
        db.session.commit()
        print("已初始化預設水上活動選項")
    else:
        print("資料庫已有資料，跳過初始化。")

# ==========================================
# API 路由
# ==========================================

@app.route('/')
def index():
    return render_template('index.html')

# --- Itinerary API ---
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
    item.title = data.get('title', item.title)
    item.details = data.get('details', item.details)
    item.time_range = data.get('time_range', item.time_range)
    item.map_link = data.get('map_link', item.map_link)
    log_change('itinerary', 'UPDATE', id, f"修改行程: {item.title}")
    db.session.commit()
    return jsonify(item.to_dict())

@app.route('/api/itinerary/<int:id>', methods=['DELETE'])
def delete_itinerary(id):
    item = ItineraryItem.query.get_or_404(id)
    db.session.delete(item)
    log_change('itinerary', 'DELETE', id, f"刪除行程: {item.title}")
    db.session.commit()
    return jsonify({'message': 'Deleted'})

# --- Foods API ---
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
    db.session.commit()
    return jsonify(new_item.to_dict()), 201

@app.route('/api/foods/<int:id>', methods=['PUT'])
def update_food(id):
    item = FoodItem.query.get_or_404(id)
    data = request.get_json()
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
    return jsonify({'message': 'Deleted'})

# --- Prep API ---
@app.route('/api/prep', methods=['GET'])
def get_prep():
    items = PrepItem.query.all()
    return jsonify([item.to_dict() for item in items])

@app.route('/api/prep', methods=['POST'])
def add_prep():
    data = request.get_json()
    new_item = PrepItem(category=data['category'], name=data['name'], is_checked=False)
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
    return jsonify({'message': 'Deleted'})

# --- Budget API ---
@app.route('/api/budget', methods=['GET'])
def get_budget():
    setting = TripSetting.query.filter_by(key='budget').first()
    return jsonify({'value': setting.value if setting else '0'})

@app.route('/api/budget', methods=['PUT'])
def update_budget():
    data = request.get_json()
    new_val = str(data.get('value', 0))
    setting = TripSetting.query.filter_by(key='budget').first()
    if setting:
        setting.value = new_val
    else:
        db.session.add(TripSetting(key='budget', value=new_val))
    db.session.commit()
    return jsonify({'value': new_val})

# --- Activities API ---

@app.route('/api/activities', methods=['GET'])
def get_activities():
    options = ActivityOption.query.order_by(ActivityOption.created_at).all()
    votes = ActivityVote.query.all()
    result = []
    for opt in options:
        opt_votes = [v.to_dict() for v in votes if v.option_id == opt.id]
        result.append({
            'id': opt.id,
            'name': opt.name,
            'cost': opt.cost,
            'votes': opt_votes
        })
    return jsonify(result)

@app.route('/api/activities', methods=['POST'])
def add_activity_option():
    data = request.get_json()
    name = data.get('name')
    cost = data.get('cost', '費用未定') # 如果沒填就預設 "費用未定"
    if not name: return jsonify({'error': 'Name is required'}), 400
    
    new_option = ActivityOption(name=name, cost=cost)
    db.session.add(new_option)
    db.session.flush()
    log_change('activity', 'CREATE', new_option.id, f"發起新團: {name} (${cost})")
    db.session.commit()
    return jsonify(new_option.to_dict()), 201

@app.route('/api/activities/<int:id>', methods=['PUT'])
def update_activity_option(id):
    option = ActivityOption.query.get_or_404(id)
    data = request.get_json()
    
    old_name = option.name
    old_cost = option.cost
    
    if 'name' in data: option.name = data['name']
    if 'cost' in data: option.cost = str(data['cost']) # 強制轉成文字存進去
    
    log_change('activity', 'UPDATE', id, f"修改揪團: {old_name}(${old_cost}) -> {option.name}(${option.cost})")
    db.session.commit()
    return jsonify(option.to_dict())

@app.route('/api/activities/<int:id>', methods=['DELETE'])
def delete_activity_option(id):
    ActivityVote.query.filter_by(option_id=id).delete()
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
    db.session.delete(vote)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)