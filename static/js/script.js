document.addEventListener('DOMContentLoaded', () => {
    
    // 全域變數
    let globalItineraries = [];
    let globalFoods = [];

    // --- 時間計算小工具 ---
    function addMinutesToTime(timeStr, minutesToAdd) {
        if (!timeStr) return "";
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h);
        date.setMinutes(m + minutesToAdd);
        // 格式化回 HH:mm
        const newH = String(date.getHours()).padStart(2, '0');
        const newM = String(date.getMinutes()).padStart(2, '0');
        return `${newH}:${newM}`;
    }

    // 1. 初始化 Chart.js (交通圖表)
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

    // 2. 導覽列與頁籤邏輯
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

    // 3. 搜尋功能邏輯
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim().toLowerCase();
        
        const filteredItineraries = globalItineraries.filter(item => 
            item.title.toLowerCase().includes(keyword) || 
            item.details.toLowerCase().includes(keyword)
        );
        renderTimeline(filteredItineraries);

        const filteredFoods = globalFoods.filter(item => 
            item.name.toLowerCase().includes(keyword) || 
            item.description.toLowerCase().includes(keyword) ||
            (item.category === 'seafood' && '海鮮'.includes(keyword)) ||
            (item.category === 'snack' && '小吃'.includes(keyword)) ||
            (item.category === 'dessert' && '甜點'.includes(keyword))
        );
        renderFoodGrid(filteredFoods);
    });

    // 4. 資料讀取與渲染

    // 行程部分
    function fetchItinerary() {
        fetch('/api/itinerary')
            .then(response => response.json())
            .then(data => {
                // 【修改點】在此處進行排序：先比對 Day，再比對開始時間
                data.sort((a, b) => {
                    if (a.day !== b.day) return a.day.localeCompare(b.day);
                    // 取出 "09:00 - 11:00" 前面的 "09:00" 來比較
                    const timeA = (a.time_range || '').split('-')[0].trim();
                    const timeB = (b.time_range || '').split('-')[0].trim();
                    return timeA.localeCompare(timeB);
                });

                globalItineraries = data; // 存入全域變數
                renderTimeline(data);     // 渲染排序後的資料
            })
            .catch(err => console.error('無法讀取行程:', err));
    }

    function renderTimeline(items) {
        ['day1', 'day2', 'day3', 'day4'].forEach(day => {
            const container = document.querySelector(`#${day}-content .timeline-container`);
            if(container) {
                const existingItems = container.querySelectorAll('.timeline-item');
                existingItems.forEach(item => item.remove());
            }
        });

        items.forEach(item => {
            const container = document.querySelector(`#${item.day}-content .timeline-container`);
            if (container) {
                const html = createTimelineItemHTML(item);
                const addBtnDiv = container.querySelector('.text-center');
                addBtnDiv.insertAdjacentHTML('beforebegin', html);
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

    // 美食部分
    function fetchFood() {
        fetch('/api/foods')
            .then(res => res.json())
            .then(data => {
                globalFoods = data;
                renderFoodGrid(data);
            });
    }

    function renderFoodGrid(items) {
        const grid = document.getElementById('food-grid');
        grid.innerHTML = '';

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

    document.getElementById('food-filters').addEventListener('click', (e) => {
        if (e.target.matches('.filter-button')) {
            const filter = e.target.dataset.filter;
            document.querySelectorAll('#food-filters .filter-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const filteredByCat = filter === 'all' ? globalFoods : globalFoods.filter(x => x.category === filter);
            renderFoodGrid(filteredByCat);
        }
    });

    // 5. 編輯/新增/刪除 互動邏輯
    const itemModal = document.getElementById('item-modal');
    const itemForm = document.getElementById('item-form');

    // --- 時間連動邏輯 (New!) ---
    const startTimeInput = document.getElementById('modal-start-time');
    const endTimeInput = document.getElementById('modal-end-time');
    const add15Btn = document.getElementById('add-15m-btn');

    // A. 當「開始時間」改變時，結束時間自動 +1 小時
    startTimeInput.addEventListener('change', () => {
        if (startTimeInput.value) {
            // 自動設定為 1 小時後 (60分鐘)
            endTimeInput.value = addMinutesToTime(startTimeInput.value, 60);
        }
    });

    // B. 點擊「+15分」按鈕
    add15Btn.addEventListener('click', () => {
        if (endTimeInput.value) {
            endTimeInput.value = addMinutesToTime(endTimeInput.value, 15);
        } else if (startTimeInput.value) {
            // 如果結束時間是空的，就從開始時間往加 15 分
            endTimeInput.value = addMinutesToTime(startTimeInput.value, 15);
        }
    });

    // 新增行程 Modal 開啟
    document.querySelectorAll('.add-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('modal-day').value = e.target.dataset.day;
            itemForm.reset(); 
            // 這裡不需要改，reset() 會自動清空新的 time input
            itemModal.classList.remove('hidden');
        });
    });
    document.getElementById('modal-cancel').addEventListener('click', () => itemModal.classList.add('hidden'));

    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const startTime = document.getElementById('modal-start-time').value;
        const endTime = document.getElementById('modal-end-time').value;

        // 【修改點】防呆檢查：結束時間必須晚於開始時間
        if (endTime <= startTime) {
            alert("⚠️ 結束時間必須晚於開始時間！\n請重新調整時間。");
            // 也可以顯示我寫在 HTML 裡的 id="time-error-msg"
            // document.getElementById('time-error-msg').classList.remove('hidden');
            return; // 阻止程式繼續往下跑
        }

        const combinedTime = `${startTime} - ${endTime}`;

        const payload = {
            day: document.getElementById('modal-day').value,
            time_range: combinedTime,
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
                fetchItinerary();
            }
        });
    });


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
    // 6. 行前準備清單邏輯 (New! 這是您缺少的)
    // ==========================================
    
    const prepGrid = document.getElementById('prep-grid');
    
    function loadPrep() {
        fetch('/api/prep')
            .then(res => res.json())
            .then(data => {
                renderPrepList(data);
            });
    }

    function renderPrepList(items) {
        prepGrid.innerHTML = '';
        
        const categories = [
            { id: 'doc', title: '🪪 重要證件', color: 'border-cyan-500' },
            { id: 'water', title: '🌊 水上活動', color: 'border-blue-500' },
            { id: 'wear', title: '👕 衣物穿搭', color: 'border-amber-500' },
            { id: 'other', title: '🔌 3C 與其他', color: 'border-gray-400' }
        ];

        categories.forEach(cat => {
            const catItems = items.filter(i => i.category === cat.id);
            
            const sectionHtml = `
            <div class="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full">
                <div class="bg-gray-50 px-4 py-3 border-t-4 ${cat.color} flex justify-between items-center">
                    <h3 class="font-bold text-gray-800">${cat.title}</h3>
                    <span class="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">${catItems.filter(i=>i.is_checked).length}/${catItems.length}</span>
                </div>
                <ul class="divide-y divide-gray-100 flex-1">
                    ${catItems.length ? catItems.map(item => `
                        <li class="prep-item group flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition cursor-pointer ${item.is_checked ? 'bg-gray-50' : ''}" data-id="${item.id}">
                            <div class="flex items-center flex-1" onclick="togglePrep(${item.id}, ${!item.is_checked})">
                                <div class="w-5 h-5 rounded border ${item.is_checked ? 'bg-cyan-500 border-cyan-500' : 'border-gray-300 bg-white'} flex items-center justify-center mr-3 transition">
                                    ${item.is_checked ? '<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
                                </div>
                                <span class="${item.is_checked ? 'text-gray-400 line-through' : 'text-gray-700'} select-none">${item.name}</span>
                            </div>
                            <button onclick="deletePrep(${item.id})" class="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </li>
                    `).join('') : '<li class="px-4 py-8 text-center text-gray-400 text-sm">尚無項目</li>'}
                </ul>
            </div>
            `;
            prepGrid.insertAdjacentHTML('beforeend', sectionHtml);
        });
    }

    window.togglePrep = function(id, newStatus) {
        fetch(`/api/prep/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_checked: newStatus })
        }).then(() => loadPrep());
    };

    window.deletePrep = function(id) {
        if(confirm('確定要刪除此項目嗎？')) {
            fetch(`/api/prep/${id}`, { method: 'DELETE' })
            .then(() => loadPrep());
        }
    };

    // 新增清單 Modal 邏輯
    const prepModal = document.getElementById('prep-modal');
    const prepForm = document.getElementById('prep-form');
    
    document.getElementById('add-prep-btn').addEventListener('click', () => {
        prepForm.reset();
        prepModal.classList.remove('hidden');
    });
    
    document.getElementById('prep-modal-cancel').addEventListener('click', () => {
        prepModal.classList.add('hidden');
    });

    prepForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
            category: document.getElementById('prep-category').value,
            name: document.getElementById('prep-name').value
        };
        fetch('/api/prep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) {
                prepModal.classList.add('hidden');
                loadPrep();
            }
        });
    });

    // 啟動
    loadPrep(); // <--- 這一行非常重要，您之前可能少了它
    fetchItinerary();
    fetchFood();
    switchPage('overview');
});