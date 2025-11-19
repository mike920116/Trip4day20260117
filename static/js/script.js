

document.addEventListener('DOMContentLoaded', () => {
    
    // 全域變數：用來儲存從資料庫抓回來的原始資料
    let globalItineraries = [];
    let globalFoods = [];

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
    // 2. 導覽列與頁籤邏輯
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
    // 3. 搜尋功能邏輯 (New!)
    // ==========================================
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        
        // 1. 過濾行程
        const filteredItineraries = globalItineraries.filter(item => 
            item.title.toLowerCase().includes(keyword) || 
            item.details.toLowerCase().includes(keyword)
        );
        renderTimeline(filteredItineraries);

        // 2. 過濾美食
        const filteredFoods = globalFoods.filter(item => 
            item.name.toLowerCase().includes(keyword) || 
            item.description.toLowerCase().includes(keyword) ||
            (item.category === 'seafood' && '海鮮'.includes(keyword)) ||
            (item.category === 'snack' && '小吃'.includes(keyword)) ||
            (item.category === 'dessert' && '甜點'.includes(keyword))
        );
        renderFoodGrid(filteredFoods);
        
        // 小優化：如果搜尋有結果，自動跳轉到相關分頁？
        // 這裡暫時不強制跳轉，讓使用者自己切換查看
    });

    // ==========================================
    // 4. 資料讀取與渲染 (Fetch & Render)
    // ==========================================

    // --- A. 行程部分 ---
    function fetchItinerary() {
        fetch('/api/itinerary')
            .then(response => response.json())
            .then(data => {
                globalItineraries = data; // 存入全域變數
                renderTimeline(data);     // 初始渲染
            })
            .catch(err => console.error('無法讀取行程:', err));
    }

    function renderTimeline(items) {
        // 1. 先清空目前畫面上 4 個天數裡面的舊行程 (保留按鈕)
        ['day1', 'day2', 'day3', 'day4'].forEach(day => {
            const container = document.querySelector(`#${day}-content .timeline-container`);
            // 移除所有 timeline-item，但保留 add-item-btn
            const existingItems = container.querySelectorAll('.timeline-item');
            existingItems.forEach(item => item.remove());
        });

        // 2. 重新繪製
        items.forEach(item => {
            const container = document.querySelector(`#${item.day}-content .timeline-container`);
            if (container) {
                const html = createTimelineItemHTML(item);
                const addBtnDiv = container.querySelector('.text-center'); // 找到按鈕容器
                addBtnDiv.insertAdjacentHTML('beforebegin', html); // 插在按鈕前面
            }
        });
    }

    function createTimelineItemHTML(item) {
        const mapHtml = item.map_link 
            ? `<a href="${item.map_link}" target="_blank" class="map-display text-cyan-600 hover:text-cyan-800 text-sm mt-1 inline-block">導航 ↗</a>` 
            : '';
        
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

    // --- B. 美食部分 ---
    function fetchFood() {
        fetch('/api/foods')
            .then(res => res.json())
            .then(data => {
                globalFoods = data; // 存入全域變數
                renderFoodGrid(data);
            });
    }

    function renderFoodGrid(items) {
        const grid = document.getElementById('food-grid');
        grid.innerHTML = ''; // 清空

        if (items.length === 0) {
            grid.innerHTML = '<p class="text-gray-500 col-span-3 text-center py-10">沒有找到符合的美食...</p>';
            return;
        }

        items.forEach(item => {
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
    }

    // 美食篩選按鈕 (原本的功能)
    document.getElementById('food-filters').addEventListener('click', (e) => {
        if (e.target.matches('.filter-button')) {
            const filter = e.target.dataset.filter;
            document.querySelectorAll('#food-filters .filter-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // 使用目前的搜尋關鍵字來二次過濾，或重置
            // 為求簡單，點擊分類按鈕時，我們暫時忽略搜尋框，直接顯示該分類
            // 如果要連動，可以在這裡讀取 searchInput.value
            const filteredByCat = filter === 'all' ? globalFoods : globalFoods.filter(x => x.category === filter);
            renderFoodGrid(filteredByCat);
        }
    });

    // ==========================================
    // 5. 編輯/新增/刪除 互動邏輯
    // ==========================================
    const itemModal = document.getElementById('item-modal');
    const itemForm = document.getElementById('item-form');

    // 新增行程
    document.querySelectorAll('.add-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('modal-day').value = e.target.dataset.day;
            itemForm.reset();
            itemModal.classList.remove('hidden');
        });
    });
    document.getElementById('modal-cancel').addEventListener('click', () => itemModal.classList.add('hidden'));

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
        }).then(response => {
            if (response.ok) {
                itemModal.classList.add('hidden');
                fetchItinerary(); // 重新讀取
            }
        });
    });

    // 編輯與刪除
    const itinerarySection = document.getElementById('itinerary');
    itinerarySection.addEventListener('click', (e) => {
        const target = e.target;
        const timelineItem = target.closest('.timeline-item');
        if (!timelineItem) return;
        const id = timelineItem.dataset.id;

        if (target.matches('.delete-btn')) {
            if (confirm('確定要刪除嗎？')) {
                fetch(`/api/itinerary/${id}`, { method: 'DELETE' })
                    .then(res => { if (res.ok) timelineItem.remove(); });
            }
        } else if (target.matches('.edit-btn')) {
            toggleEditSave(timelineItem, true);
        } else if (target.matches('.save-btn')) {
            const payload = {
                title: timelineItem.querySelector('.title-edit').value,
                details: timelineItem.querySelector('.details-edit').value,
                time_range: timelineItem.querySelector('.time-edit').value,
                map_link: timelineItem.querySelector('.map-edit').value
            };
            fetch(`/api/itinerary/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(updatedItem => {
                timelineItem.querySelector('.title-display').innerText = updatedItem.title;
                timelineItem.querySelector('.details-display').innerText = updatedItem.details;
                timelineItem.querySelector('.time-display').innerText = updatedItem.time_range;
                // (此處省略地圖連結更新DOM邏輯以保持簡潔，若需要可加回)
                toggleEditSave(timelineItem, false);
            });
        }
    });

    function toggleEditSave(item, isEditing) {
        item.querySelector('.item-display').classList.toggle('hidden', isEditing);
        item.querySelector('.item-edit').classList.toggle('hidden', !isEditing);
        item.querySelector('.edit-btn').classList.toggle('hidden', isEditing);
        item.querySelector('.save-btn').classList.toggle('hidden', !isEditing);
    }

    // ==========================================
    // 啟動
    // ==========================================
    fetchItinerary();
    fetchFood();
    switchPage('overview');
});