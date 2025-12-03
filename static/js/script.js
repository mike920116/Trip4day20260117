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
        const newH = String(date.getHours()).padStart(2, '0');
        const newM = String(date.getMinutes()).padStart(2, '0');
        return `${newH}:${newM}`;
    }

    // --- 金額格式化小工具 ---
    function formatCurrency(n) {
        return 'NT$ ' + new Intl.NumberFormat('zh-TW').format(n);
    }

    // 1. 初始化 Chart.js
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

    // 2. 導覽列與頁籤
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

    // 3. 搜尋功能
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

    // 4. 行程讀取與渲染
    function fetchItinerary() {
        fetch('/api/itinerary')
            .then(response => response.json())
            .then(data => {
                data.sort((a, b) => {
                    if (a.day !== b.day) return a.day.localeCompare(b.day);
                    const timeA = (a.time_range || '').split('-')[0].trim();
                    const timeB = (b.time_range || '').split('-')[0].trim();
                    return timeA.localeCompare(timeB);
                });
                globalItineraries = data;
                renderTimeline(data);
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
            ? `<a href="${item.map_link}" target="_blank" class="map-display text-cyan-600 hover:text-cyan-800 text-sm mt-1 inline-block font-medium">查看地圖 ↗</a>` 
            : '';
        
        return `
        <div class="timeline-item p-4 bg-white rounded-lg border border-gray-100 hover:shadow-md transition-shadow duration-200" data-id="${item.id}">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="inline-block px-2 py-1 bg-cyan-50 text-cyan-700 text-xs font-bold rounded">${item.time_range}</span>
                    </div>
                    <h4 class="title-display font-bold text-xl text-gray-800 mb-1">${item.title}</h4>
                    <p class="details-display text-gray-600 text-sm mb-2 leading-relaxed">${item.details}</p>
                    ${mapHtml}
                </div>
                
                <div class="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0 mt-2 sm:mt-0">
                    <button class="edit-btn flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-md transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        編輯
                    </button>
                    <button class="delete-btn flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        刪除
                    </button>
                </div>
            </div>
        </div>`;
    }

    // 5. 行程 Modal & 互動
    const itemModal = document.getElementById('item-modal');
    const itemForm = document.getElementById('item-form');
    const modalTitle = document.getElementById('modal-title');
    const modalDayInput = document.getElementById('modal-day');
    const modalIdInput = document.getElementById('modal-item-id');

    const startTimeInput = document.getElementById('modal-start-time');
    const endTimeInput = document.getElementById('modal-end-time');
    const add15Btn = document.getElementById('add-15m-btn');

    startTimeInput.addEventListener('change', () => {
        if (startTimeInput.value) {
            endTimeInput.value = addMinutesToTime(startTimeInput.value, 60);
        }
    });

    add15Btn.addEventListener('click', () => {
        if (endTimeInput.value) {
            endTimeInput.value = addMinutesToTime(endTimeInput.value, 15);
        } else if (startTimeInput.value) {
            endTimeInput.value = addMinutesToTime(startTimeInput.value, 15);
        }
    });

    document.querySelectorAll('.add-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            itemForm.reset();
            modalIdInput.value = "";
            modalDayInput.value = e.target.dataset.day;
            modalTitle.innerText = "新增行程";
            itemModal.classList.remove('hidden');
        });
    });

    document.getElementById('modal-cancel').addEventListener('click', () => itemModal.classList.add('hidden'));

    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        if (endTime <= startTime) {
            alert("⚠️ 結束時間必須晚於開始時間！");
            return; 
        }
        const combinedTime = `${startTime} - ${endTime}`;
        
        const id = modalIdInput.value;
        const isEditMode = !!id;

        const payload = {
            day: modalDayInput.value,
            time_range: combinedTime,
            title: document.getElementById('modal-title-input').value,
            details: document.getElementById('modal-details').value,
            map_link: document.getElementById('modal-map').value
        };

        const url = isEditMode ? `/api/itinerary/${id}` : '/api/itinerary';
        const method = isEditMode ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(response => {
            if (response.ok) {
                itemModal.classList.add('hidden');
                fetchItinerary();
            } else {
                alert("儲存失敗");
            }
        });
    });

    const itinerarySection = document.getElementById('itinerary');
    itinerarySection.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        
        const timelineItem = e.target.closest('.timeline-item');
        if (!timelineItem) return;
        const id = timelineItem.dataset.id;

        if (deleteBtn) {
            if (confirm('確定要刪除此行程嗎？')) {
                fetch(`/api/itinerary/${id}`, { method: 'DELETE' })
                    .then(res => { 
                        if (res.ok) {
                            globalItineraries = globalItineraries.filter(x => x.id != id);
                            timelineItem.remove(); 
                        }
                    });
            }
        } else if (editBtn) {
            const itemData = globalItineraries.find(x => x.id == id);
            if (!itemData) return;

            modalIdInput.value = itemData.id;
            modalDayInput.value = itemData.day;
            document.getElementById('modal-title-input').value = itemData.title;
            document.getElementById('modal-details').value = itemData.details || '';
            document.getElementById('modal-map').value = itemData.map_link || '';
            
            if (itemData.time_range && itemData.time_range.includes('-')) {
                const parts = itemData.time_range.split('-');
                startTimeInput.value = parts[0].trim();
                endTimeInput.value = parts[1].trim();
            } else {
                startTimeInput.value = "";
                endTimeInput.value = "";
            }

            modalTitle.innerText = "編輯行程";
            itemModal.classList.remove('hidden');
        }
    });

    // --- 美食部分 ---
    function fetchFood() {
        fetch('/api/foods')
            .then(res => res.json())
            .then(data => {
                globalFoods = data;
                const currentFilter = document.querySelector('#food-filters .filter-button.active').dataset.filter;
                renderFoodGrid(filterFoods(currentFilter));
            });
    }

    function filterFoods(filterType) {
        if (filterType === 'all') return globalFoods;
        if (filterType === 'favorite') return globalFoods.filter(item => item.is_favorite);
        return globalFoods.filter(item => item.category === filterType);
    }

    function renderFoodGrid(items) {
        const grid = document.getElementById('food-grid');
        grid.innerHTML = '';

        if (items.length === 0) {
            grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-10">這裡還沒有美食，快去新增吧！</p>';
            return;
        }

        items.forEach(item => {
            const labelText = item.category === 'seafood' ? '海鮮/正餐' : (item.category === 'snack' ? '在地小吃' : '甜點/飲料');
            const labelColor = item.category === 'seafood' ? 'bg-cyan-100 text-cyan-800' : (item.category === 'snack' ? 'bg-amber-100 text-amber-800' : 'bg-pink-100 text-pink-800');
            
            const heartIcon = item.is_favorite 
                ? `<svg class="w-6 h-6 text-red-500 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
                : `<svg class="w-6 h-6 text-gray-400 stroke-current fill-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

            const mapLink = item.link 
                ? `<a href="${item.link}" target="_blank" class="text-cyan-600 hover:text-cyan-800 text-sm mt-2 inline-block">Google Maps ↗</a>` 
                : '';

            const html = `
            <div class="food-card bg-white rounded-lg shadow-lg overflow-hidden relative" data-id="${item.id}">
                <button onclick="toggleFavorite(${item.id}, ${!item.is_favorite})" class="absolute top-3 right-3 p-2 bg-white rounded-full shadow-sm hover:shadow-md transition transform hover:scale-110 z-10">
                    ${heartIcon}
                </button>

                <div class="p-5 pb-16"> 
                    <span class="text-xs font-semibold ${labelColor} px-2 py-1 rounded-full">${labelText}</span>
                    <h3 class="text-xl font-bold text-gray-900 mt-2 mb-1">${item.name}</h3>
                    <p class="text-gray-600 text-sm line-clamp-3">${item.description}</p>
                    ${mapLink}
                </div>

                <div class="absolute bottom-0 left-0 w-full bg-gray-50 border-t border-gray-100 px-4 py-3 flex justify-end gap-2">
                    <button onclick="openEditFood(${item.id})" class="text-sm bg-white border border-cyan-500 text-cyan-600 hover:bg-cyan-50 font-medium px-3 py-1 rounded shadow-sm transition">編輯</button>
                    <button onclick="deleteFood(${item.id})" class="text-sm bg-white border border-red-500 text-red-500 hover:bg-red-50 font-medium px-3 py-1 rounded shadow-sm transition">刪除</button>
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
            renderFoodGrid(filterFoods(filter));
        }
    });

    window.toggleFavorite = function(id, newStatus) {
        fetch(`/api/foods/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_favorite: newStatus })
        }).then(() => fetchFood());
    };

    window.deleteFood = function(id) {
        if(confirm('確定要刪除這家美食嗎？')) {
            fetch(`/api/foods/${id}`, { method: 'DELETE' })
            .then(() => fetchFood());
        }
    };

    const foodModal = document.getElementById('food-modal');
    const foodForm = document.getElementById('food-form');
    const foodIdInput = document.getElementById('food-id');
    const foodTitle = document.getElementById('food-modal-title');

    document.getElementById('add-food-btn').addEventListener('click', () => {
        foodForm.reset();
        foodIdInput.value = "";
        foodTitle.innerText = "新增美食";
        foodModal.classList.remove('hidden');
    });

    document.getElementById('food-cancel').addEventListener('click', () => foodModal.classList.add('hidden'));

    window.openEditFood = function(id) {
        const item = globalFoods.find(x => x.id === id);
        if (!item) return;

        foodIdInput.value = item.id;
        document.getElementById('food-name').value = item.name;
        document.getElementById('food-category').value = item.category;
        document.getElementById('food-desc').value = item.description;
        document.getElementById('food-link').value = item.link;
        
        foodTitle.innerText = "編輯美食";
        foodModal.classList.remove('hidden');
    };

    foodForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = foodIdInput.value;
        const isEdit = !!id;
        
        const payload = {
            name: document.getElementById('food-name').value,
            category: document.getElementById('food-category').value,
            description: document.getElementById('food-desc').value,
            link: document.getElementById('food-link').value
        };

        const url = isEdit ? `/api/foods/${id}` : '/api/foods';
        const method = isEdit ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) {
                foodModal.classList.add('hidden');
                fetchFood();
            } else {
                alert("儲存失敗");
            }
        });
    });

    // 6. 行前準備清單邏輯
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

    // 7. 預算邏輯
    const budgetDisplay = document.getElementById('budget-display');
    const budgetInput = document.getElementById('budget-input');
    const budgetEditBtn = document.getElementById('budget-edit');
    const budgetSaveBtn = document.getElementById('budget-save');
    const budgetCancelBtn = document.getElementById('budget-cancel');

    function loadBudget() {
        fetch('/api/budget')
            .then(res => res.json())
            .then(data => {
                budgetDisplay.innerText = formatCurrency(data.value);
            });
    }

    budgetEditBtn.addEventListener('click', () => {
        const valStr = budgetDisplay.innerText.replace(/[^0-9]/g, '');
        budgetInput.value = valStr;
        budgetDisplay.classList.add('hidden');
        budgetInput.classList.remove('hidden');
        budgetEditBtn.classList.add('hidden');
        budgetSaveBtn.classList.remove('hidden');
        budgetCancelBtn.classList.remove('hidden');
        budgetInput.focus();
    });

    budgetCancelBtn.addEventListener('click', () => {
        budgetInput.classList.add('hidden');
        budgetDisplay.classList.remove('hidden');
        budgetEditBtn.classList.remove('hidden');
        budgetSaveBtn.classList.add('hidden');
        budgetCancelBtn.classList.add('hidden');
    });

    budgetSaveBtn.addEventListener('click', () => {
        const val = Number(budgetInput.value);
        if (isNaN(val) || val < 0) {
            alert('請輸入有效的數字金額');
            return;
        }
        
        fetch('/api/budget', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: val })
        }).then(res => res.json())
        .then(data => {
            budgetDisplay.innerText = formatCurrency(data.value);
            budgetInput.classList.add('hidden');
            budgetDisplay.classList.remove('hidden');
            budgetEditBtn.classList.remove('hidden');
            budgetSaveBtn.classList.add('hidden');
            budgetCancelBtn.classList.add('hidden');
        });
    });

    // --- 8. 活動揪團邏輯 (動態資料庫版) ---
    const voteBoard = document.getElementById('vote-board');
    const voteModal = document.getElementById('vote-modal');
    const createModal = document.getElementById('create-activity-modal');
    const voteCountInput = document.getElementById('vote-count');
    
    const cardColors = [
        'bg-cyan-50 text-cyan-800 border-cyan-200',
        'bg-amber-50 text-amber-800 border-amber-200', 
        'bg-emerald-50 text-emerald-800 border-emerald-200',
        'bg-indigo-50 text-indigo-800 border-indigo-200',
        'bg-rose-50 text-rose-800 border-rose-200',
        'bg-violet-50 text-violet-800 border-violet-200'
    ];

    function loadVotes() {
        fetch('/api/activities')
            .then(res => res.json())
            .then(data => {
                renderVoteBoard(data);
            });
    }

    function renderVoteBoard(activities) {
        if(!voteBoard) return;
        voteBoard.innerHTML = '';
        
        activities.forEach((act, index) => {
            const totalCount = act.votes.reduce((sum, v) => sum + v.count, 0);
            const colorClass = cardColors[index % cardColors.length];
            
            const listHtml = act.votes.map(v => `
                <div class="flex justify-between items-center text-sm mb-1 group border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                    <span class="text-gray-700 font-medium">${v.name} 
                        <span class="text-xs text-gray-500 bg-white border px-1.5 rounded-full ml-1 shadow-sm">+${v.count}</span>
                    </span>
                    <button onclick="deleteVote(${v.id})" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1" title="刪除">×</button>
                </div>
            `).join('');

            const cardHtml = `
                <div class="border rounded-xl shadow-sm hover:shadow-md transition-all duration-300 bg-white flex flex-col h-full group/card relative">
                    <button onclick="deleteActivity(${act.id}, '${act.name}')" class="absolute top-2 right-2 text-gray-300 hover:text-red-400 opacity-0 group-hover/card:opacity-100 transition z-10 p-1" title="刪除此團">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <div class="${colorClass} px-4 py-3 border-b flex justify-between items-center rounded-t-xl">
                        <h4 class="font-bold text-lg truncate pr-6" title="${act.name}">${act.name}</h4>
                        <span class="bg-white/80 px-2 py-0.5 rounded text-sm font-bold shadow-sm whitespace-nowrap">
                            ${totalCount} 人
                        </span>
                    </div>
                    <div class="p-4 flex-1 bg-gray-50/30">
                        ${listHtml ? `<div class="space-y-1">${listHtml}</div>` : `<p class="text-gray-400 text-sm text-center italic py-2">目前無人報名</p>`}
                    </div>
                    <div class="p-3 border-t bg-white rounded-b-xl">
                        <button onclick="openVoteModal(${act.id}, '${act.name}')" class="w-full py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50 transition flex items-center justify-center gap-1 text-sm font-medium">
                            <span>+</span> 我要加入
                        </button>
                    </div>
                </div>
            `;
            voteBoard.insertAdjacentHTML('beforeend', cardHtml);
        });

        const addCardHtml = `
            <button onclick="openCreateModal()" class="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50 transition min-h-[200px] h-full">
                <div class="w-12 h-12 rounded-full bg-gray-100 mb-3 flex items-center justify-center text-2xl group-hover:bg-white transition">＋</div>
                <span class="font-medium">發起新揪團</span>
                <span class="text-xs mt-1 opacity-70">沒有喜歡的行程嗎？<br>自己開一個！</span>
            </button>
        `;
        voteBoard.insertAdjacentHTML('beforeend', addCardHtml);
    }

    window.openVoteModal = function(optionId, name) {
        document.getElementById('vote-activity-code').value = optionId;
        document.getElementById('vote-modal-title').innerText = `加入「${name}」`;
        document.getElementById('vote-name').value = '';
        document.getElementById('vote-count').value = 1;
        voteModal.classList.remove('hidden');
        voteModal.classList.add('flex');
        setTimeout(() => document.getElementById('vote-name').focus(), 100);
    };
    
    window.closeVoteModal = function() {
        voteModal.classList.add('hidden');
        voteModal.classList.remove('flex');
    };
    
    if(document.getElementById('vote-cancel')) document.getElementById('vote-cancel').onclick = closeVoteModal;
    if(document.getElementById('vote-modal-bg')) document.getElementById('vote-modal-bg').onclick = closeVoteModal;

    window.openCreateModal = function() {
        document.getElementById('new-activity-name').value = '';
        createModal.classList.remove('hidden');
        createModal.classList.add('flex');
        setTimeout(() => document.getElementById('new-activity-name').focus(), 100);
    }

    window.closeCreateModal = function() {
        createModal.classList.add('hidden');
        createModal.classList.remove('flex');
    }

    window.adjustVoteCount = function(delta) {
        let val = parseInt(voteCountInput.value) || 1;
        val += delta;
        if (val < 1) val = 1;
        voteCountInput.value = val;
    };

    if(document.getElementById('vote-form')) {
        document.getElementById('vote-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {
                option_id: document.getElementById('vote-activity-code').value,
                name: document.getElementById('vote-name').value,
                count: parseInt(document.getElementById('vote-count').value)
            };
            fetch('/api/votes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                if(res.ok) { closeVoteModal(); loadVotes(); }
            });
        });
    }

    if(document.getElementById('create-activity-form')) {
        document.getElementById('create-activity-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('new-activity-name').value.trim();
            if(!name) return;
            
            fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            }).then(res => {
                if(res.ok) { closeCreateModal(); loadVotes(); }
            });
        });
    }

    window.deleteVote = function(id) {
        if(confirm('確定要刪除這筆報名資料嗎？')) {
            fetch(`/api/votes/${id}`, { method: 'DELETE' }).then(() => loadVotes());
        }
    };

    window.deleteActivity = function(id, name) {
        if(confirm(`確定要刪除「${name}」這個揪團嗎？\n裡面的報名資料也會一併刪除喔！`)) {
            fetch(`/api/activities/${id}`, { method: 'DELETE' }).then(() => loadVotes());
        }
    };

    // 啟動
    loadBudget();
    loadPrep(); 
    fetchItinerary();
    fetchFood();
    loadVotes();
    switchPage('overview');
});