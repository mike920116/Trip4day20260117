## 🏝️ 小琉球 4 天 3 夜旅遊規劃系統 (Trip4day20260117)

這是一個基於 Flask 的旅遊行程規劃網站，專為年輕人設計。
功能包含：
- 行程時間軸管理
- 預算計算
- 互動式美食地圖
- 水上活動揪團投票功能

---

### ⚙️ 環境設定與安裝

#### 1. 安裝依賴套件
請確保 `requirements.txt` 中已包含 Flask-Migrate。

```bash
pip install -r requirements.txt
```

#### 2. 初始化資料庫遷移環境 (僅需執行一次)
如果專案中還沒有 `migrations/` 資料夾，請執行：

```bash
flask db init
```

---

### 🛠️ 資料庫修改標準流程 (SOP)

當您修改了 `app.py` 中的資料庫模型 (Model)，例如新增 `cost` 欄位或建立新資料表時，請務必按照以下步驟操作：

#### 1. 本地開發階段 (Local)

**步驟一：產生遷移腳本 (Make Migrations)**
讓 Flask 自動偵測程式碼與資料庫的差異，並產生更新腳本。

```bash
flask db migrate -m "描述您修改了什麼 (例如: add cost column)"
```

**步驟二：更新本地資料庫 (Upgrade)**
將產生的腳本應用到您電腦上的資料庫，確認沒問題。

```bash
flask db upgrade
```

**步驟三：提交到 GitHub**

> ⚠️ **重要：務必將 `migrations/` 資料夾內的變更一併提交，這樣雲端才知道如何更新。**

```bash
git add .
git commit -m "Update DB schema"
git push
```

#### 2. 雲端部署階段 (Zeabur)

程式碼推送到 GitHub 後，Zeabur 會自動重新部署網站，但資料庫不會自動更新。您需要手動執行：

1. 進入 Zeabur 控制台
2. 點選您的服務 (Service)
3. 切換到「Console (主控台)」頁籤
4. 在終端機輸入以下指令並按 Enter：

```bash
flask db upgrade
```

看到執行完畢的訊息 (Running upgrade...) 即代表雲端資料庫已同步更新。

---

### 🌱 其他常用指令

#### 初始化/重置預設資料 (Seed Data)
如果您在新的環境（或資料庫清空後）想要寫入預設的活動選項（如：浮潛、SUP），請執行：

```bash
flask seed
```

#### 啟動開發伺服器

```bash
flask run
```
或
```bash
python app.py
```
