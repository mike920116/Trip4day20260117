// static/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. 初始化 Chart.js (交通圖表 - 保持靜態)
    // ==========================================
    const transportCtx = document.getElementById('transportChart').getContext('2d');
    new Chart(transportCtx, {
        type: 'bar',
        data: {
            labels: ['🚄 高鐵方案', '🚆 台鐵方案', '🚗 開車方案'],
            datasets: [
                {
                    label: '預估總時長 (小時)',
                    data: [3.25, 5.5, 5.5], 
                    backgroundColor: 'rgba(6, 182, 212, 0.6)', 
                    borderColor: 'rgba(6, 182, 212, 1)',
                    borderWidth: 1,
                    yAxisID: 'yAxisTime'
                },
                {
                    label: '預估總花費 (NT$)',
                    data: [1900, 1100, 2400], 
                    backgroundColor: 'rgba(245, 158, 11, 0.6)', 
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1,
                    yAxisID: 'yAxisCost'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                yAxisTime: { type: 'linear', position: 'left', title: { display: true, text: '小時' } },
                yAxisCost: { type: 'linear', position: 'right', title: { display: true, text: 'NT$' }, grid: { drawOnChartArea: false } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                if (context.dataset.yAxisID === 'yAxisCost') {
                                    label += new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(context.parsed.y);
                                } else {
                                    label += context.parsed.y + ' 小時';
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // ==========================================
    // 2. 導覽列與頁籤邏輯 (UI 切換)
    // ==========================================
    const navLinks = document.querySelectorAll('.nav-link');
    const pageSections = document.querySelectorAll('.page-section');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    function switchPage(targetId) {
        pageSections.forEach(section => section.classList.toggle('active', section.id === targetId));
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.target === targetId));
        if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
    }

    document.getElementById('nav-links').addEventListener('click', (e) => {
        if (e.target.matches('.nav-link')) { e.preventDefault(); switchPage(e.target.dataset.target); }
    });
    document.getElementById('mobile-nav-links').addEventListener('click', (e) => {
        if (e.target.matches('.nav-link')) { e.preventDefault(); switchPage(e.target.dataset.target); }
    });
    mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

    // 每日行程頁籤切換
    const dayTabs = document.getElementById('day-tabs');
    const tabButtons = Array.from(dayTabs.querySelectorAll('.tab-button'));
    const dayContents = document.querySelectorAll('.day-content');

    function activateTab(button) {
        const targetDay = button.dataset.day;
        tabButtons.forEach(btn => {
            const isActive = btn === button;
            btn.classList.toggle('active', isActive);
        });
        dayContents.forEach(content => {
            content.classList.toggle('active', content.id === `${targetDay}-content`);
        });
    }

    dayTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-button');
        if (!btn) return;
        activateTab(btn);
    });

    // ==========================================
    // 3. 【核心】前後端串接邏輯 (Fetch API)
    // ==========================================

    // --- A. 讀取並渲染行程 (Read) ---
    function loadItinerary() {
        fetch('/api/itinerary')
            .then(response => response.json())
            .then(data => {
                // 1. 先清空目前畫面上 4 個天數裡面的舊行程 (只保留 "新增行程" 按鈕)
                ['day1', 'day2', 'day3', 'day4'].forEach(day => {
                    const container = document.querySelector(`#${day}-content .timeline-container`);
                    const items = container.querySelectorAll('.timeline-item');
                    items.forEach(item => item.remove());
                });

                // 2. 遍歷資料庫回傳的資料，一筆一筆畫上去
                data.forEach(item => {
                    const container = document.querySelector(`#${item.day}-content .timeline-container`);
                    if (container) {
                        const html = createTimelineItemHTML(item);
                        // 插入在 "新增行程" 按鈕之前
                        const addBtnDiv = container.querySelector('.text-center');
                        addBtnDiv.insertAdjacentHTML('beforebegin', html);
                    }
                });
            })
            .catch(err => console.error('無法讀取行程:', err));
    }

    // 產生行程卡片的 HTML 樣板
    function createTimelineItemHTML(item) {
        const mapHtml = item.map_link 
            ? `<a href="${item.map_link}" target="_blank" class="map-display text-cyan-600 hover:text-cyan-800 text-sm mt-1 inline-block">導航 ↗</a>` 
            : '';
        
        // 注意：我們在最外層加了 data-id，方便等一下做刪除功能
        return `
        <div class="timeline-item" data-id="${item.id}">
            <div class="flex items-center mb-1">
                <span class="time-display font-semibold text-cyan-700 text-lg">${item.time_range}</span>
                <input type="text" class="time-edit hidden form-input w-full" value="${item.time_range}">
            </div>
            <div class="ml-1">
                <div class="item-display">
                    <h4 class="title-display font-bold text-xl text-gray-900">${item.title}</h4>
                    <p class="details-display text-gray-600">${item.details}</p>
                    ${mapHtml}
                </div>
                <div class="item-edit hidden space-y-2">
                    <input type="text" class="title-edit form-input w-full" value="${item.title}">
                    <textarea class="details-edit form-input w-full">${item.details}</textarea>
                    <input type="text" class="map-edit form-input w-full" value="${item.map_link}">
                </div>
            </div>
            <div class="item-controls mt-2 space-x-2">
                <button class="edit-btn text-xs text-blue-500 hover:text-blue-700">編輯</button>
                <button class="save-btn hidden text-xs text-green-500 hover:text-green-700">儲存</button>
                <button class="delete-btn text-xs text-red-500 hover:text-red-700">刪除</button>
            </div>
        </div>`;
    }

    // --- B. 處理新增行程 (Create) ---
    const itemModal = document.getElementById('item-modal');
    const itemForm = document.getElementById('item-form');

    // 打開 Modal
    document.querySelectorAll('.add-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('modal-day').value = e.target.dataset.day;
            itemForm.reset();
            itemModal.classList.remove('hidden');
        });
    });

    // 關閉 Modal
    document.getElementById('modal-cancel').addEventListener('click', () => itemModal.classList.add('hidden'));

    // 送出表單
    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const payload = {
            day: document.getElementById('modal-day').value,
            time_range: document.getElementById('modal-time').value,
            title: document.getElementById('modal-title-input').value,
            details: document.getElementById('modal-details').value,
            map_link: document.getElementById('modal-map').value
        };

        fetch('/api/itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.ok) {
                itemModal.classList.add('hidden');
                loadItinerary(); // 重新讀取資料，畫面就會更新
            } else {
                alert('新增失敗');
            }
        });
    });

    // --- C. 處理刪除與編輯 (Delete / Update UI) ---
    const itinerarySection = document.getElementById('itinerary');
    
    itinerarySection.addEventListener('click', (e) => {
        const target = e.target;
        const timelineItem = target.closest('.timeline-item');
        if (!timelineItem) return;
        
        const id = timelineItem.dataset.id;

        // 刪除功能
        if (target.matches('.delete-btn')) {
            if (confirm('確定要從資料庫永久刪除此行程嗎？')) {
                fetch(`/api/itinerary/${id}`, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (response.ok) {
                        timelineItem.remove(); // 直接從畫面移除，不用重整全部
                    } else {
                        alert('刪除失敗');
                    }
                });
            }
        }
        // 編輯按鈕 (切換 UI)
        else if (target.matches('.edit-btn')) {
            toggleEditSave(timelineItem, true);
        }
        // 儲存按鈕 (已實作 Update API)
        else if (target.matches('.save-btn')) {
            const title = timelineItem.querySelector('.title-edit').value;
            const details = timelineItem.querySelector('.details-edit').value;
            const timeRange = timelineItem.querySelector('.time-edit').value;
            const mapLink = timelineItem.querySelector('.map-edit').value;

            const payload = {
                title: title,
                details: details,
                time_range: timeRange,
                map_link: mapLink
            };

            fetch(`/api/itinerary/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Update failed');
            })
            .then(updatedItem => {
                // 1. 更新畫面文字
                timelineItem.querySelector('.title-display').innerText = updatedItem.title;
                timelineItem.querySelector('.details-display').innerText = updatedItem.details;
                timelineItem.querySelector('.time-display').innerText = updatedItem.time_range;
                
                // 2. 智慧更新地圖連結 (有無連結的 DOM 操作)
                const displayContainer = timelineItem.querySelector('.item-display');
                let mapLinkEl = displayContainer.querySelector('.map-display');
                
                if (updatedItem.map_link) {
                    // 如果原本沒有連結 DOM，就創造一個
                    if (!mapLinkEl) {
                        mapLinkEl = document.createElement('a');
                        mapLinkEl.className = 'map-display text-cyan-600 hover:text-cyan-800 text-sm mt-1 inline-block';
                        mapLinkEl.target = '_blank';
                        mapLinkEl.innerText = '導航 ↗';
                        displayContainer.appendChild(mapLinkEl);
                    }
                    mapLinkEl.href = updatedItem.map_link;
                    mapLinkEl.classList.remove('hidden'); // 確保它是顯示的
                } else {
                    // 如果新資料沒有連結，但原本有 DOM，就隱藏它
                    if (mapLinkEl) {
                        mapLinkEl.classList.add('hidden');
                    }
                }

                // 3. 切換回顯示模式
                toggleEditSave(timelineItem, false);
            })
            .catch(err => {
                alert('儲存失敗，請檢查伺服器連線');
                console.error(err);
            });
        }
    });

    function toggleEditSave(item, isEditing) {
        item.querySelector('.item-display').classList.toggle('hidden', isEditing);
        item.querySelector('.item-edit').classList.toggle('hidden', !isEditing);
        item.querySelector('.edit-btn').classList.toggle('hidden', isEditing);
        item.querySelector('.save-btn').classList.toggle('hidden', !isEditing);
    }

    // --- D. 讀取並渲染美食 (Read) ---
    function loadFood() {
        fetch('/api/foods')
            .then(res => res.json())
            .then(data => {
                const grid = document.getElementById('food-grid');
                grid.innerHTML = ''; // 清空

                data.forEach(item => {
                    const labelText = item.category === 'seafood' ? '海鮮/正餐' : (item.category === 'snack' ? '在地小吃' : '甜點/飲料');
                    const labelColor = item.category === 'seafood' ? 'bg-cyan-100 text-cyan-800' : (item.category === 'snack' ? 'bg-amber-100 text-amber-800' : 'bg-pink-100 text-pink-800');
                    
                    const html = `
                    <div class="food-card bg-white rounded-lg shadow-lg overflow-hidden" data-category="${item.category}">
                        <div class="p-5">
                            <span class="text-xs font-semibold ${labelColor} px-2 py-1 rounded-full">${labelText}</span>
                            <h3 class="text-xl font-bold text-gray-900 mt-2">${item.name}</h3>
                            <p class="text-gray-600 text-sm mt-1">${item.description}</p>
                            <a href="${item.link}" target="_blank" class="text-cyan-600 hover:text-cyan-800 text-sm mt-3 inline-block">在 Google Maps 上查看 ↗</a>
                        </div>
                    </div>`;
                    grid.insertAdjacentHTML('beforeend', html);
                });
            });
    }

    // 美食篩選功能
    document.getElementById('food-filters').addEventListener('click', (e) => {
        if (e.target.matches('.filter-button')) {
            const filter = e.target.dataset.filter;
            document.querySelectorAll('#food-filters .filter-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            document.querySelectorAll('.food-card').forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) card.classList.remove('hidden');
                else card.classList.add('hidden');
            });
        }
    });

    // ==========================================
    // 4. 啟動應用程式
    // ==========================================
    loadItinerary();
    loadFood();
    switchPage('overview');
});