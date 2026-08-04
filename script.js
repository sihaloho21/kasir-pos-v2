// Default API URL (Fallback)
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxz260m0RdQa2YNBVzt7RU7PQG3ZeaVwr6VmTGQEfF18FVFxTmtbBEkMOIQ1y_ZkuKc/exec";

// Get API URL from localStorage or use default
let API_URL = localStorage.getItem('pos_api_url') || DEFAULT_API_URL;

let products = [];
let cart = [];
let pinnedSkus = JSON.parse(localStorage.getItem('pinned_skus') || '[]');
let pinnedSortMode = localStorage.getItem('pinned_sort_mode') || 'default';
let reportProfitData = {
    warung: null,
    fish: null,
    digital: null,
    manual: []
};

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    const settingsInput = document.getElementById('settings-api-url');
    if (settingsInput) settingsInput.value = API_URL;

    fetchProducts();
    fetchDashboard();

    document.addEventListener('keydown', handleNotificationShortcut);
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', debounce(filterProducts, 300));
    
    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    
    const btnBayar = document.getElementById('btn-bayar');
    if (btnBayar) btnBayar.addEventListener('click', processPayment);

    ['fish-qty', 'fish-price', 'fish-cogs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateFishPreview);
    });

    ['digital-nominal', 'digital-price'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateDigitalPreview);
    });
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(title, message, type = 'success') {
    const modal = document.getElementById('notification-modal');
    const content = document.getElementById('modal-content');
    const iconContainer = document.getElementById('modal-icon-container');
    const icon = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');

    if (!modal || !content || !titleEl || !messageEl) return;

    titleEl.innerText = title;
    messageEl.innerText = message;
    iconContainer.className = 'mx-auto flex items-center justify-center h-20 w-20 rounded-full mb-6';
    icon.className = 'fas text-4xl';

    if (type === 'success') {
        iconContainer.classList.add('bg-green-100', 'text-green-600');
        icon.classList.add('fa-check-circle');
    } else if (type === 'error') {
        iconContainer.classList.add('bg-red-100', 'text-red-600');
        icon.classList.add('fa-times-circle');
    } else {
        iconContainer.classList.add('bg-blue-100', 'text-blue-600');
        icon.classList.add('fa-info-circle');
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeNotification() {
    const modal = document.getElementById('notification-modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function handleNotificationShortcut(event) {
    if (event.key !== 'Escape') return;

    const modal = document.getElementById('notification-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    closeNotification();
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('bg-teal-700', 'active'));
    
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.remove('hidden');
    
    if (window.event && window.event.currentTarget && window.event.currentTarget.classList.contains('nav-link')) {
        window.event.currentTarget.classList.add('bg-teal-700', 'active');
    }

    if (pageId === 'report') {
        renderReportProfitSummary();
        fetchDailyProfit();
        fetchFishProfit();
        fetchDigitalProfit();
        fetchManualMonthly();
    }
}

function saveSettings() {
    const settingsInput = document.getElementById('settings-api-url');
    if (!settingsInput) return;
    const newUrl = settingsInput.value.trim();
    if (!newUrl) return alert('URL tidak boleh kosong!');
    localStorage.setItem('pos_api_url', newUrl);
    API_URL = newUrl;
    alert('Pengaturan disimpan!');
    location.reload();
}

// --- DIGITAL POS LOGIC ---
function updateDigitalPreview() {
    const nominal = parseFloat(document.getElementById('digital-nominal').value) || 0;
    const price = parseFloat(document.getElementById('digital-price').value) || 0;
    const preview = document.getElementById('preview-digital-profit');
    if (preview) preview.innerText = formatRupiah(price - nominal);
}

function setDigitalPrice(price) {
    const priceInput = document.getElementById('digital-price');
    if (!priceInput) return;
    priceInput.value = price;
    updateDigitalPreview();
}

async function processDigitalSale() {
    const nominal = document.getElementById('digital-nominal').value;
    const hargaJual = parseFloat(document.getElementById('digital-price').value);
    const catatan = document.getElementById('digital-note').value;
    if (isNaN(hargaJual)) return alert('Harga Jual wajib diisi!');

    const btn = document.getElementById('btn-bayar-digital');
    try {
        btn.disabled = true;
        btn.innerText = 'MENYIMPAN...';
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'processDigitalSale', nominal, hargaJual, catatan })
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Transaksi Digital Berhasil Disimpan');
            ['digital-nominal', 'digital-price', 'digital-note'].forEach(id => document.getElementById(id).value = '');
            updateDigitalPreview();
            fetchDashboard();
        } else {
            showNotification('Gagal!', res.message, 'error');
        }
    } catch (e) {
        showNotification('Kesalahan!', 'Terjadi kesalahan koneksi!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'SIMPAN TRANSAKSI DIGITAL';
    }
}

// --- FISH POS LOGIC ---
function updateFishPreview() {
    const qty = parseFloat(document.getElementById('fish-qty').value) || 0;
    const price = parseFloat(document.getElementById('fish-price').value) || 0;
    const cogs = parseFloat(document.getElementById('fish-cogs').value) || 0;
    const total = qty * price;
    const profit = total - (qty * cogs);
    const pTotal = document.getElementById('preview-fish-total');
    const pProfit = document.getElementById('preview-fish-profit');
    if (pTotal) pTotal.innerText = formatRupiah(total);
    if (pProfit) pProfit.innerText = formatRupiah(profit);
}

async function processFishSale() {
    const jenisIkan = document.getElementById('fish-type').value;
    const qtyKg = parseFloat(document.getElementById('fish-qty').value);
    const hargaJual = parseFloat(document.getElementById('fish-price').value);
    const cogsKg = parseFloat(document.getElementById('fish-cogs').value);

    if (!jenisIkan || isNaN(qtyKg) || isNaN(hargaJual) || isNaN(cogsKg)) return alert('Harap isi semua data!');

    const btn = document.getElementById('btn-bayar-ikan');
    try {
        btn.disabled = true;
        btn.innerText = 'MENYIMPAN...';
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'processFishSale', jenisIkan, qtyKg, hargaJual, cogsKg })
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Transaksi Ikan Berhasil Disimpan');
            ['fish-qty', 'fish-price', 'fish-cogs'].forEach(id => document.getElementById(id).value = '');
            updateFishPreview();
            fetchDashboard();
        } else {
            showNotification('Gagal!', res.message, 'error');
        }
    } catch (e) {
        showNotification('Kesalahan!', 'Terjadi kesalahan koneksi!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'SIMPAN TRANSAKSI IKAN';
    }
}

// --- REPORTING LOGIC ---
async function fetchDailyProfit() {
    const tableBody = document.getElementById('daily-profit-table-body');
    if (!tableBody) return;
    try {
        const response = await fetch(`${API_URL}?action=getDailyProfitStats`);
        const data = await response.json();
        if (Array.isArray(data)) {
            reportProfitData.warung = data;
            renderDailyProfitTable(data, 'daily-profit-table-body');
            renderReportProfitSummary();
        }
    } catch (error) { console.error(error); }
}

async function fetchFishProfit() {
    const tableBody = document.getElementById('fish-profit-table-body');
    if (!tableBody) return;
    try {
        const response = await fetch(`${API_URL}?action=getFishProfitStats`);
        const data = await response.json();
        if (Array.isArray(data)) {
            reportProfitData.fish = data;
            renderDailyProfitTable(data, 'fish-profit-table-body');
            renderReportProfitSummary();
        }
    } catch (error) { console.error(error); }
}

async function fetchDigitalProfit() {
    const tableBody = document.getElementById('digital-profit-table-body');
    if (!tableBody) return;
    try {
        const response = await fetch(`${API_URL}?action=getDigitalProfitStats`);
        const data = await response.json();
        if (Array.isArray(data)) {
            reportProfitData.digital = data;
            renderDailyProfitTable(data, 'digital-profit-table-body');
            renderReportProfitSummary();
        }
    } catch (error) { console.error(error); }
}

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthLabel() {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date());
}

function summarizeMonthlyProfit(data) {
    const monthKey = getCurrentMonthKey();
    if (!Array.isArray(data)) return { omzet: 0, laba: 0, isLoaded: false };

    return data
        .filter(row => (row.tanggal || '').startsWith(monthKey))
        .reduce((summary, row) => {
            summary.omzet += Number(row.omzet) || 0;
            summary.laba += Number(row.laba) || 0;
            return summary;
        }, { omzet: 0, laba: 0, isLoaded: true });
}

function getMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) return monthKey;
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function addMonthlyIncomeRows(monthlyMap, data, segmentKey) {
    if (!Array.isArray(data)) return;

    data.forEach(row => {
        const tanggal = row.tanggal || '';
        const monthKey = tanggal.slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;

        if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { monthKey, warung: 0, fish: 0, digital: 0 };
        }

        monthlyMap[monthKey][segmentKey] += Number(row.laba) || 0;
    });
}

function renderMonthlyIncomeTable() {
    const tableBody = document.getElementById('monthly-income-table-body');
    if (!tableBody) return;

    const isLoaded = Array.isArray(reportProfitData.warung) && Array.isArray(reportProfitData.fish) && Array.isArray(reportProfitData.digital);
    if (!isLoaded) {
        tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Memuat...</td></tr>';
        return;
    }

    const monthlyMap = {};
    
    // Add manual data first
    if (Array.isArray(reportProfitData.manual)) {
        reportProfitData.manual.forEach(m => {
            monthlyMap[m.bulan] = { monthKey: m.bulan, warung: m.warung, fish: m.fish, digital: m.digital };
        });
    }

    // Add/Update with automatic data
    addMonthlyIncomeRows(monthlyMap, reportProfitData.warung, 'warung');
    addMonthlyIncomeRows(monthlyMap, reportProfitData.fish, 'fish');
    addMonthlyIncomeRows(monthlyMap, reportProfitData.digital, 'digital');

    const rows = Object.values(monthlyMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    if (!rows.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Tidak ada data</td></tr>';
        return;
    }

    tableBody.innerHTML = rows.map(row => {
        const total = row.warung + row.fish + row.digital;
        return `
            <tr class="border-b border-gray-50 last:border-b-0">
                <td class="px-6 py-4 font-bold text-gray-800 whitespace-nowrap">${getMonthLabel(row.monthKey)}</td>
                <td class="px-6 py-4 font-bold text-teal-700">${formatRupiah(row.warung)}</td>
                <td class="px-6 py-4 font-bold text-blue-700">${formatRupiah(row.fish)}</td>
                <td class="px-6 py-4 font-bold text-purple-700">${formatRupiah(row.digital)}</td>
                <td class="px-6 py-4 font-black text-gray-900 bg-teal-50/30">${formatRupiah(total)}</td>
            </tr>
        `;
    }).join('');
}

function renderReportProfitSummary() {
    const container = document.getElementById('report-profit-summary');
    const monthLabel = document.getElementById('report-month-label');
    if (!container) return;

    if (monthLabel) monthLabel.innerText = `Ringkasan ${getCurrentMonthLabel()}`;

    const summaries = {
        warung: summarizeMonthlyProfit(reportProfitData.warung),
        fish: summarizeMonthlyProfit(reportProfitData.fish),
        digital: summarizeMonthlyProfit(reportProfitData.digital)
    };
    const isTotalLoaded = summaries.warung.isLoaded && summaries.fish.isLoaded && summaries.digital.isLoaded;
    const totalLaba = summaries.warung.laba + summaries.fish.laba + summaries.digital.laba;

    const createSummaryCard = (title, icon, color, summary) => `
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div class="flex items-center justify-between mb-4">
                <div class="w-10 h-10 rounded-lg ${color.bg} ${color.text} flex items-center justify-center">
                    <i class="fas ${icon}"></i>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Laba Bulan Ini</span>
            </div>
            <p class="text-xs font-bold text-gray-500 mb-1">${title}</p>
            <p class="text-2xl font-black text-gray-900">${formatRupiah(summary.laba)}</p>
            <div class="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                <span class="text-[10px] text-gray-400">Omzet</span>
                <span class="text-xs font-bold text-gray-700">${formatRupiah(summary.omzet)}</span>
            </div>
        </div>
    `;

    container.innerHTML = `
        ${createSummaryCard('Warung', 'fa-store', { bg: 'bg-teal-50', text: 'text-teal-600' }, summaries.warung)}
        ${createSummaryCard('Ikan', 'fa-fish', { bg: 'bg-blue-50', text: 'text-blue-600' }, summaries.fish)}
        ${createSummaryCard('Digital', 'fa-mobile-alt', { bg: 'bg-purple-50', text: 'text-purple-600' }, summaries.digital)}
        <div class="bg-teal-600 rounded-xl shadow-lg p-5 text-white sm:col-span-1 lg:col-span-1">
            <div class="flex items-center justify-between mb-4">
                <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <i class="fas fa-wallet text-white"></i>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wide text-white/60">Total Bersih</span>
            </div>
            <p class="text-xs font-bold text-white/80 mb-1">Total Laba Gabungan</p>
            <p class="text-3xl font-black text-white">${formatRupiah(totalLaba)}</p>
            <div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span class="text-[10px] text-white/60">Status</span>
                <span class="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase">Updated</span>
            </div>
        </div>
    `;
    renderMonthlyIncomeTable();
}

function renderDailyProfitTable(data, targetId) {
    const tableBody = document.getElementById(targetId);
    if (!tableBody) return;
    tableBody.innerHTML = data.length ? '' : '<tr><td colspan="3" class="p-4 text-center text-gray-400">Tidak ada data</td></tr>';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 text-xs text-gray-600">${row.tanggal}</td>
            <td class="px-4 py-3 text-xs font-bold text-gray-800">${formatRupiah(row.omzet)}</td>
            <td class="px-4 py-3 text-xs font-bold text-teal-600">${formatRupiah(row.laba)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        products = await response.json();
        renderProducts(products);
        renderPinnedProducts();
    } catch (error) { console.error(error); }
}

async function fetchDashboard() {
    try {
        const response = await fetch(`${API_URL}?action=getDashboardStats`);
        const stats = await response.json();
        
        const omzetEl = document.getElementById('today-omzet');
        if (omzetEl && stats.segments) omzetEl.innerText = formatRupiah(stats.segments.warung.omzet);

        if (stats.segments) {
            const sWarung = document.getElementById('summary-laba-warung');
            const sFish = document.getElementById('summary-laba-fish');
            const sDigital = document.getElementById('summary-laba-digital');
            const sTotal = document.getElementById('summary-total-laba');
            
            const lW = stats.segments.warung?.laba || 0;
            const lF = stats.segments.fish?.laba || 0;
            const lD = stats.segments.digital?.laba || 0;

            if (sWarung) sWarung.innerText = formatRupiah(lW);
            if (sFish) sFish.innerText = formatRupiah(lF);
            if (sDigital) sDigital.innerText = formatRupiah(lD);
            if (sTotal) sTotal.innerText = formatRupiah(lW + lF + lD);
        }
        renderDashboard(stats);
    } catch (error) { console.error(error); }
}

function renderDashboard(stats) {
    const container = document.getElementById('dashboard-content');
    const summaryContainer = document.getElementById('dashboard-summary');
    if (!container || !stats) return;

    if (summaryContainer) {
        const createCard = (title, segment, color) => `
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">${title}</h4>
                <div class="flex items-baseline space-x-2">
                    <span class="text-lg font-black text-gray-800">${formatRupiah(segment?.laba)}</span>
                    <span class="text-[10px] text-gray-400">Laba</span>
                </div>
                <div class="mt-2 text-[10px] text-gray-500">Omzet: <span class="font-bold">${formatRupiah(segment?.omzet)}</span></div>
            </div>
        `;
        summaryContainer.innerHTML = `
            ${createCard('Warung', stats.segments?.warung, 'teal')}
            ${createCard('Ikan', stats.segments?.fish, 'blue')}
            ${createCard('Digital', stats.segments?.digital, 'purple')}
        `;
    }
}

function renderProducts(data) {
    const grid = document.getElementById('product-grid');
    if (!grid || !data) return;
    const fragment = document.createDocumentFragment();
    const sortedProducts = [...data].sort((a, b) => {
        const todaySoldDiff = (Number(b.Qty_Terjual) || 0) - (Number(a.Qty_Terjual) || 0);
        if (todaySoldDiff !== 0) return todaySoldDiff;
        return (a.Nama_Produk || '').localeCompare(b.Nama_Produk || '', 'id');
    });

    sortedProducts.slice(0, 20).forEach(p => {
        const sisaStok = p.SISA_STOK || 0;
        const isLow = sisaStok < 5;
        const isPinned = pinnedSkus.includes(p.SKU);
        const card = document.createElement('div');
        card.className = `product-card relative bg-white p-4 rounded-xl border ${isLow ? 'border-red-500 bg-red-50' : 'border-gray-100'} flex flex-col items-center text-center cursor-pointer hover:shadow-md transition`;
        
        card.onclick = () => addToCart(p);
        
        card.innerHTML = `
            <button onclick="event.stopPropagation(); togglePin('${p.SKU}')" class="absolute top-2 right-2 p-1 text-xs ${isPinned ? 'text-teal-600' : 'text-gray-300 hover:text-teal-400'} transition">
                <i class="fas fa-thumbtack ${isPinned ? '' : 'opacity-50'}"></i>
            </button>
            <div class="flex-1 flex flex-col items-center">
                <div class="w-10 h-10 ${isLow ? 'bg-red-500' : 'bg-teal-600'} text-white flex items-center justify-center rounded-lg font-bold mb-2">${(p.Nama_Produk || '??').substring(0, 2).toUpperCase()}</div>
                <h3 class="text-xs font-medium text-gray-700 h-8 overflow-hidden">${p.Nama_Produk || 'Tanpa Nama'}</h3>
                <p class="text-teal-600 font-bold text-sm">${formatRupiah(p.Perkiraan_Harga_Rp)}</p>
                <p class="text-[9px] text-gray-400 italic">M: ${formatRupiah(p.Harga_Modal_Rp)}</p>
                <p class="text-[10px] ${isLow ? 'text-red-600 font-bold' : 'text-gray-400'}">Stok: ${sisaStok}</p>
            </div>
            <button onclick="event.stopPropagation(); openUpdateModal(${JSON.stringify(p).replace(/"/g, '&quot;')})" class="mt-2 text-[10px] font-bold text-gray-400 hover:text-teal-600 uppercase tracking-tighter"><i class="fas fa-edit mr-1"></i>Update Harga</button>
        `;
        fragment.appendChild(card);
    });
    grid.innerHTML = '';
    grid.appendChild(fragment);
}

function togglePin(sku) {
    const index = pinnedSkus.indexOf(sku);
    if (index > -1) {
        pinnedSkus.splice(index, 1);
    } else {
        pinnedSkus.push(sku);
    }
    localStorage.setItem('pinned_skus', JSON.stringify(pinnedSkus));
    renderProducts(products);
    renderPinnedProducts();
}

function renderPinnedProducts() {
    const container = document.getElementById('pinned-products-container');
    const grid = document.getElementById('pinned-products-grid');
    if (!container || !grid) return;

    let pinnedItems = products.filter(p => pinnedSkus.includes(p.SKU));
    
    if (pinnedItems.length === 0) {
        container.classList.add('hidden');
        return;
    }

    // Apply Sorting
    if (pinnedSortMode === 'az') {
        pinnedItems.sort((a, b) => (a.Nama_Produk || '').localeCompare(b.Nama_Produk || '', 'id'));
    } else if (pinnedSortMode === 'price') {
        pinnedItems.sort((a, b) => (Number(a.Perkiraan_Harga_Rp) || 0) - (Number(b.Perkiraan_Harga_Rp) || 0));
    }

    container.classList.remove('hidden');
    grid.innerHTML = '';
    
    pinnedItems.forEach(p => {
        const btn = document.createElement('button');
        btn.className = "flex items-center space-x-2 bg-white border border-teal-100 hover:border-teal-400 px-3 py-2 rounded-lg shadow-sm transition active:scale-95 whitespace-nowrap";
        btn.onclick = () => addToCart(p);
        btn.innerHTML = `
            <div class="w-6 h-6 bg-teal-50 text-teal-600 rounded flex items-center justify-center text-[10px] font-black">
                ${(p.Nama_Produk || '??').substring(0, 1).toUpperCase()}
            </div>
            <div class="text-left">
                <p class="text-[10px] font-bold text-gray-800 leading-tight">${p.Nama_Produk}</p>
                <div class="flex items-center space-x-2">
                    <p class="text-[9px] text-teal-600 font-black">${formatRupiah(p.Perkiraan_Harga_Rp)}</p>
                    <p class="text-[8px] text-gray-400 italic">M: ${formatRupiah(p.Harga_Modal_Rp)}</p>
                </div>
            </div>
        `;
        grid.appendChild(btn);
    });
}


function addToCart(p) {
    if (!p || !p.SKU) return;
    // Selalu tambah baris baru, tidak merge dengan item yang sama
    const basePrice = p.Perkiraan_Harga_Rp || 0;
    cart.push({ 
        SKU: p.SKU, 
        Nama_Produk: p.Nama_Produk, 
        Satuan: p.Satuan, 
        Harga_Satuan: basePrice, 
        Base_Price: basePrice, // Simpan harga asli untuk perhitungan proporsional
        Qty: 1, 
        Total: basePrice,
        cartId: Date.now() + Math.random() // ID unik untuk setiap baris
    });
    renderCart();
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.focus();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    if (!container || !totalEl) return;
    const fragment = document.createDocumentFragment();
    let total = 0;
    cart.forEach((item, index) => {
        total += item.Total;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center border-b border-gray-50 pb-2";
        const displayQty = Number(item.Qty).toLocaleString('id-ID', { maximumFractionDigits: 3 });
        div.innerHTML = `
            <div class="flex-1">
                <h4 class="text-xs font-bold">${item.Nama_Produk}</h4>
                <div class="flex flex-col mt-1">
                    <span class="text-[9px] text-gray-400 italic">${displayQty} ${item.Satuan || ''} @ ${formatRupiah(item.Base_Price)}</span>
                    <div class="flex items-center mt-0.5">
                        <span class="text-[10px] text-gray-500 mr-1">Total: Rp</span>
                        <input type="number" 
                               class="w-24 px-1 py-0.5 text-[10px] font-bold border border-gray-200 rounded focus:border-teal-500 focus:outline-none" 
                               value="${item.Total}" 
                               title="Masukkan total harga untuk menyesuaikan jumlah otomatis"
                               onchange="updateManualPriceByCartId('${item.cartId}', this.value)">
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="updateQtyByCartId('${item.cartId}', -1)" class="text-gray-400 hover:text-red-500"><i class="fas fa-minus-circle"></i></button>
                <span class="text-xs font-bold">${displayQty}</span>
                <button onclick="updateQtyByCartId('${item.cartId}', 1)" class="text-gray-400 hover:text-green-500"><i class="fas fa-plus-circle"></i></button>
            </div>
        `;
        fragment.appendChild(div);
    });
    container.innerHTML = cart.length ? '' : '<p class="text-center text-gray-400 text-xs mt-10">Kosong</p>';
    if (cart.length) container.appendChild(fragment);
    totalEl.innerText = formatRupiah(total);
}

function updateManualPrice(index, enteredPrice) {
    if (index < 0 || index >= cart.length) return;
    const item = cart[index];
    const total = parseFloat(enteredPrice) || 0;
    const basePrice = item.Base_Price || item.Harga_Satuan;

    if (basePrice > 0) {
        // Hitung Qty proporsional: Total / Harga Satuan Asli
        item.Qty = total / basePrice;
        item.Total = total;
        // Harga_Satuan tetap menggunakan basePrice agar perhitungan di backend konsisten
        item.Harga_Satuan = basePrice;
    } else {
        item.Total = total;
        item.Qty = 1;
        item.Harga_Satuan = total;
    }
    
    renderCart();
}

function updateManualPriceByCartId(cartId, enteredPrice) {
    const item = cart.find(i => i.cartId == cartId);
    if (!item) return;
    const total = parseFloat(enteredPrice) || 0;
    const basePrice = item.Base_Price || item.Harga_Satuan;

    if (basePrice > 0) {
        // Hitung Qty proporsional: Total / Harga Satuan Asli
        item.Qty = total / basePrice;
        item.Total = total;
        // Harga_Satuan tetap menggunakan basePrice agar perhitungan di backend konsisten
        item.Harga_Satuan = basePrice;
    } else {
        item.Total = total;
        item.Qty = 1;
        item.Harga_Satuan = total;
    }
    
    renderCart();
}

function updateQty(index, delta) {
    if (index < 0 || index >= cart.length) return;
    cart[index].Qty += delta;
    if (cart[index].Qty <= 0) cart.splice(index, 1);
    else cart[index].Total = cart[index].Qty * cart[index].Harga_Satuan;
    renderCart();
}

function updateQtyByCartId(cartId, delta) {
    const item = cart.find(i => i.cartId == cartId);
    if (!item) return;
    item.Qty += delta;
    if (item.Qty <= 0) {
        const index = cart.indexOf(item);
        if (index > -1) cart.splice(index, 1);
    } else {
        item.Total = item.Qty * item.Harga_Satuan;
    }
    renderCart();
}

function clearCart() { if (confirm('Bersihkan keranjang?')) { cart = []; renderCart(); } }

async function processPayment() {
    if (cart.length === 0) return alert('Keranjang kosong!');
    const btn = document.getElementById('btn-bayar');
    try {
        btn.disabled = true;
        btn.innerText = 'PROSES...';
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ items: cart }) });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Transaksi Berhasil Disimpan');
            cart = []; renderCart(); fetchProducts(); fetchDashboard();
        } else { showNotification('Gagal!', res.message, 'error'); }
    } catch (e) { showNotification('Kesalahan!', 'Gagal memproses pembayaran!', 'error'); }
    finally { btn.disabled = false; btn.innerText = 'BAYAR'; }
}

function filterProducts() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    const search = searchInput.value.toLowerCase();
    const filtered = products.filter(p => {
        const matchesSearch = (p.Nama_Produk || '').toLowerCase().includes(search) || (p.SKU || '').toString().toLowerCase().includes(search);
        return matchesSearch;
    });
    renderProducts(filtered);
}

function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
}

function openUpdateModal(p) {
    document.getElementById('update-sku').value = p.SKU;
    document.getElementById('update-nama').innerText = p.Nama_Produk;
    document.getElementById('update-harga-modal').value = p.Harga_Modal_Rp || 0;
    document.getElementById('update-harga-jual').value = p.Perkiraan_Harga_Rp || 0;
    document.getElementById('update-price-modal').classList.remove('hidden');
}

function closeUpdateModal() {
    document.getElementById('update-price-modal').classList.add('hidden');
}

async function submitPriceUpdate() {
    const sku = document.getElementById('update-sku').value;
    const hargaModal = parseFloat(document.getElementById('update-harga-modal').value);
    const hargaJual = parseFloat(document.getElementById('update-harga-jual').value);
    
    if (isNaN(hargaModal) || isNaN(hargaJual)) return alert('Harga harus diisi!');
    
    const btn = document.getElementById('btn-submit-update');
    try {
        btn.disabled = true;
        btn.innerText = 'MENYIMPAN...';
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateProductPrice', sku, hargaModal, hargaJual })
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Harga produk berhasil diperbarui');
            closeUpdateModal();
            fetchProducts();
        } else {
            showNotification('Gagal!', res.message, 'error');
        }
    } catch (e) {
        showNotification('Kesalahan!', 'Terjadi kesalahan koneksi!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'SIMPAN';
    }
}

function sortPinned(mode) {
    pinnedSortMode = mode;
    localStorage.setItem('pinned_sort_mode', mode);
    renderPinnedProducts();
}

async function refreshData() {
    const btn = document.getElementById('refresh-btn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    
    try {
        btn.disabled = true;
        if (icon) icon.classList.add('fa-spin');
        
        // Refresh products and dashboard stats
        await Promise.all([
            fetchProducts(),
            fetchDashboard()
        ]);
        
        showNotification('Berhasil!', 'Data telah diperbarui');
    } catch (error) {
        console.error('Refresh failed:', error);
        showNotification('Gagal!', 'Gagal memperbarui data', 'error');
    } finally {
        btn.disabled = false;
        if (icon) icon.classList.remove('fa-spin');
    }
}

// --- MANUAL MONTHLY LOGIC ---
async function fetchManualMonthly() {
    try {
        const response = await fetch(`${API_URL}?action=getManualMonthlyStats`);
        const data = await response.json();
        if (Array.isArray(data)) {
            reportProfitData.manual = data;
            renderMonthlyIncomeTable();
        }
    } catch (error) { console.error(error); }
}

function openManualMonthlyModal() {
    document.getElementById('manual-monthly-modal').classList.remove('hidden');
}

function closeManualMonthlyModal() {
    document.getElementById('manual-monthly-modal').classList.add('hidden');
}

async function submitManualMonthly() {
    const bulan = document.getElementById('manual-month').value;
    const warung = parseFloat(document.getElementById('manual-laba-warung').value) || 0;
    const fish = parseFloat(document.getElementById('manual-laba-fish').value) || 0;
    const digital = parseFloat(document.getElementById('manual-laba-digital').value) || 0;

    if (!bulan) return alert('Bulan wajib dipilih!');

    const btn = document.getElementById('btn-submit-manual');
    try {
        btn.disabled = true;
        btn.innerText = 'MENYIMPAN...';
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveManualMonthly', bulan, warung, fish, digital })
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Data laba manual berhasil disimpan');
            closeManualMonthlyModal();
            fetchManualMonthly();
        } else {
            showNotification('Gagal!', res.message, 'error');
        }
    } catch (e) {
        showNotification('Kesalahan!', 'Terjadi kesalahan koneksi!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'SIMPAN';
    }
}
