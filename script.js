// Default API URL (Fallback)
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxz260m0RdQa2YNBVzt7RU7PQG3ZeaVwr6VmTGQEfF18FVFxTmtbBEkMOIQ1y_ZkuKc/exec";

// Get API URL from localStorage or use default
let API_URL = localStorage.getItem('pos_api_url') || DEFAULT_API_URL;

let products = [];
let cart = [];
let selectedCategory = 'Semua';
let reportProfitData = {
    warung: null,
    fish: null,
    digital: null
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
            <p class="text-2xl font-black text-gray-900">${summary.isLoaded ? formatRupiah(summary.laba) : 'Memuat...'}</p>
            <p class="text-[10px] text-gray-400 mt-2">Omzet: ${summary.isLoaded ? formatRupiah(summary.omzet) : '-'}</p>
        </div>
    `;

    container.innerHTML = `
        ${createSummaryCard('Warung', 'fa-store', { bg: 'bg-teal-50', text: 'text-teal-600' }, summaries.warung)}
        ${createSummaryCard('Ikan', 'fa-fish', { bg: 'bg-blue-50', text: 'text-blue-600' }, summaries.fish)}
        ${createSummaryCard('Digital', 'fa-mobile-alt', { bg: 'bg-purple-50', text: 'text-purple-600' }, summaries.digital)}
        <div class="bg-gray-900 rounded-xl shadow-sm p-5 text-white">
            <div class="flex items-center justify-between mb-4">
                <div class="w-10 h-10 rounded-lg bg-white/10 text-yellow-300 flex items-center justify-center">
                    <i class="fas fa-coins"></i>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wide text-gray-300">Warung + Ikan + Digital</span>
            </div>
            <p class="text-xs font-bold text-gray-300 mb-1">Total Keseluruhan Laba</p>
            <p class="text-2xl font-black text-yellow-300">${isTotalLoaded ? formatRupiah(totalLaba) : 'Memuat...'}</p>
            <p class="text-[10px] text-gray-400 mt-2">${getCurrentMonthLabel()}</p>
        </div>
    `;
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

async function processStockAction(action) {
    const sku = document.getElementById(action === 'restock' ? 'stock-sku' : 'opname-sku').value;
    const qty = parseFloat(document.getElementById(action === 'restock' ? 'stock-qty' : 'opname-qty').value);
    const modalBaru = action === 'restock' ? parseFloat(document.getElementById('stock-modal').value) : null;
    const alasan = document.getElementById(action === 'restock' ? 'stock-alasan' : 'opname-alasan').value;

    if (!sku || isNaN(qty)) return alert('Harap isi SKU dan Jumlah!');

    const btn = document.getElementById(action === 'restock' ? 'btn-restock' : 'btn-opname');
    try {
        btn.disabled = true;
        btn.innerText = 'MEMPROSES...';
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, sku, qty, modalBaru, alasan })
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Data Stok Berhasil Diperbarui');
            ['stock-qty', 'stock-modal', 'stock-alasan', 'opname-qty', 'opname-alasan'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            fetchProducts();
        } else {
            showNotification('Gagal!', res.message, 'error');
        }
    } catch (e) {
        showNotification('Kesalahan!', 'Gagal memperbarui stok!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = action === 'restock' ? 'Simpan Stok Masuk' : 'Update Stok Fisik';
    }
}

// --- CORE POS LOGIC ---
async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        products = await response.json();
        renderCategories(products);
        renderProducts(products);
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
        const totalOmzet = (stats.segments?.warung?.omzet || 0) + (stats.segments?.fish?.omzet || 0) + (stats.segments?.digital?.omzet || 0);
        const totalLaba = (stats.segments?.warung?.laba || 0) + (stats.segments?.fish?.laba || 0) + (stats.segments?.digital?.laba || 0);
        
        summaryContainer.innerHTML = `
            <div class="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-8 text-white shadow-lg mb-8">
                <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="text-center md:text-left">
                        <p class="text-teal-100 text-xs font-bold uppercase tracking-widest mb-1">Total Omzet Hari Ini</p>
                        <h3 class="text-4xl font-black">${formatRupiah(totalOmzet)}</h3>
                    </div>
                    <div class="h-px md:h-16 w-full md:w-px bg-white/20"></div>
                    <div class="text-center md:text-left">
                        <p class="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Total Laba Bersih</p>
                        <h3 class="text-4xl font-black text-yellow-300">${formatRupiah(totalLaba)}</h3>
                    </div>
                </div>
            </div>
        `;
    }

    const createCard = (title, data, color) => {
        if (!data) return '';
        return `
            <div class="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                <div class="flex items-center mb-3">
                    <div class="w-8 h-8 rounded-lg bg-${color}-100 text-${color}-600 flex items-center justify-center mr-3">
                        <i class="fas ${title === 'Warung' ? 'fa-store' : title === 'Ikan' ? 'fa-fish' : 'fa-mobile-alt'}"></i>
                    </div>
                    <h4 class="text-sm font-bold text-gray-700 uppercase">${title}</h4>
                </div>
                <p class="text-2xl font-black text-gray-800">${formatRupiah(data.omzet)}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs text-gray-400">Laba Bersih</span>
                    <span class="text-sm font-bold text-${color}-600">${formatRupiah(data.laba)}</span>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        ${createCard('Warung', stats.segments?.warung, 'teal')}
        ${createCard('Ikan', stats.segments?.fish, 'blue')}
        ${createCard('Digital', stats.segments?.digital, 'purple')}
    `;
}

function renderCategories(data) {
    const container = document.getElementById('category-filter');
    if (!container || !data) return;
    const categories = ['Semua', ...new Set(data.map(p => p.Kategori).filter(k => k))];
    container.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `px-3 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap min-w-[80px] ${selectedCategory === cat ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-300 hover:text-teal-600'}`;
        btn.innerText = cat;
        btn.onclick = () => { selectedCategory = cat; renderCategories(data); filterProducts(); };
        container.appendChild(btn);
    });
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
        const card = document.createElement('div');
        card.className = `product-card bg-white p-4 rounded-xl border ${isLow ? 'border-red-500 bg-red-50' : 'border-gray-100'} flex flex-col items-center text-center cursor-pointer hover:shadow-md transition`;
        card.onclick = () => addToCart(p);
        card.innerHTML = `
            <div class="w-10 h-10 ${isLow ? 'bg-red-500' : 'bg-teal-600'} text-white flex items-center justify-center rounded-lg font-bold mb-2">${(p.Nama_Produk || '??').substring(0, 2).toUpperCase()}</div>
            <h3 class="text-xs font-medium text-gray-700 h-8 overflow-hidden">${p.Nama_Produk || 'Tanpa Nama'}</h3>
            <p class="text-teal-600 font-bold text-sm">${formatRupiah(p.Perkiraan_Harga_Rp)}</p>
            <p class="text-[10px] ${isLow ? 'text-red-600 font-bold' : 'text-gray-400'}">Stok: ${sisaStok}</p>
        `;
        fragment.appendChild(card);
    });
    grid.innerHTML = '';
    grid.appendChild(fragment);
    setTimeout(() => updateStockDropdowns(sortedProducts), 0);
}

function updateStockDropdowns(data) {
    ['stock-sku', 'opname-sku'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        let options = '<option value="">Pilih Produk...</option>';
        data.forEach(p => options += `<option value="${p.SKU}">${p.Nama_Produk} (Stok: ${p.SISA_STOK || 0})</option>`);
        el.innerHTML = options;
    });
}

function addToCart(p) {
    if (!p || !p.SKU) return;
    const existing = cart.find(item => item.SKU === p.SKU);
    if (existing) {
        existing.Qty += 1;
        existing.Total = existing.Qty * existing.Harga_Satuan;
    } else {
        cart.push({ SKU: p.SKU, Nama_Produk: p.Nama_Produk, Satuan: p.Satuan, Harga_Satuan: p.Perkiraan_Harga_Rp || 0, Qty: 1, Total: p.Perkiraan_Harga_Rp || 0 });
    }
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
        div.innerHTML = `
            <div class="flex-1"><h4 class="text-xs font-bold">${item.Nama_Produk}</h4><p class="text-[10px] text-gray-400">${item.Qty} x ${formatRupiah(item.Harga_Satuan)}</p></div>
            <div class="flex items-center space-x-2">
                <button onclick="updateQty(${index}, -1)" class="text-gray-400 hover:text-red-500"><i class="fas fa-minus-circle"></i></button>
                <span class="text-xs font-bold">${item.Qty}</span>
                <button onclick="updateQty(${index}, 1)" class="text-gray-400 hover:text-green-500"><i class="fas fa-plus-circle"></i></button>
            </div>
        `;
        fragment.appendChild(div);
    });
    container.innerHTML = cart.length ? '' : '<p class="text-center text-gray-400 text-xs mt-10">Kosong</p>';
    if (cart.length) container.appendChild(fragment);
    totalEl.innerText = formatRupiah(total);
}

function updateQty(index, delta) {
    if (index < 0 || index >= cart.length) return;
    cart[index].Qty += delta;
    if (cart[index].Qty <= 0) cart.splice(index, 1);
    else cart[index].Total = cart[index].Qty * cart[index].Harga_Satuan;
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
        const matchesCategory = selectedCategory === 'Semua' || p.Kategori === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    renderProducts(filtered);
}

function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
}
