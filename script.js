// Default API URL (Fallback)
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxz260m0RdQa2YNBVzt7RU7PQG3ZeaVwr6VmTGQEfF18FVFxTmtbBEkMOIQ1y_ZkuKc/exec";

// Get API URL from localStorage or use default
let API_URL = localStorage.getItem('pos_api_url') || DEFAULT_API_URL;

let products = [];
let cart = [];
let selectedCategory = 'Semua';

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    // Set value in settings input
    const settingsInput = document.getElementById('settings-api-url');
    if (settingsInput) settingsInput.value = API_URL;

    fetchProducts();
    fetchDashboard();
    fetchDailyProfit();
    fetchFishProfit();
    fetchDigitalProfit();
    
    // Pastikan elemen ada sebelum menambah listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        // Gunakan debounce untuk pencarian agar tidak lag saat mengetik cepat
        searchInput.addEventListener('input', debounce(filterProducts, 300));
    }
    
    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    
    const btnBayar = document.getElementById('btn-bayar');
    if (btnBayar) btnBayar.addEventListener('click', processPayment);

    // Supplier Analysis Listeners
    const supForm = document.getElementById('supplier-form');
    if (supForm) supForm.addEventListener('submit', handleSupplierSubmit);
    
    ['sup-qty', 'sup-harga'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const qty = parseFloat(document.getElementById('sup-qty').value) || 0;
            const harga = parseFloat(document.getElementById('sup-harga').value) || 0;
            document.getElementById('sup-total').value = qty * harga;
        });
    });

    // Fish POS Listeners
    ['fish-qty', 'fish-price', 'fish-cogs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateFishPreview);
    });

    // Digital POS Listeners
    ['digital-nominal', 'digital-price'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateDigitalPreview);
    });
});

// Helper Debounce untuk performa input
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

// Fungsi Notifikasi Modal
function showNotification(title, message, type = 'success') {
    const modal = document.getElementById('notification-modal');
    const content = document.getElementById('modal-content');
    const iconContainer = document.getElementById('modal-icon-container');
    const icon = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');

    titleEl.innerText = title;
    messageEl.innerText = message;

    // Reset classes
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
    
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// Fungsi Navigasi Halaman
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('bg-teal-700', 'active'));
    
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.remove('hidden');
    
    // Menambah class active ke tombol yang diklik
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('bg-teal-700');
    }

    // Load reports if switching to report page
    if (pageId === 'report') {
        fetchDailyProfit();
        fetchFishProfit();
        fetchDigitalProfit();
    }

    if (pageId === 'supplier') {
        fetchSupplierAnalysis();
    }
}

// Fungsi Pengaturan
function saveSettings() {
    const settingsInput = document.getElementById('settings-api-url');
    if (!settingsInput) return;
    
    const newUrl = settingsInput.value.trim();
    if (!newUrl) return alert('URL tidak boleh kosong!');
    
    localStorage.setItem('pos_api_url', newUrl);
    API_URL = newUrl;
    alert('Pengaturan disimpan! Aplikasi akan memuat ulang data.');
    
    // Refresh data
    fetchProducts();
    fetchDashboard();
    fetchDailyProfit();
    fetchFishProfit();
    fetchDigitalProfit();
    showPage('pos');
}

// --- DIGITAL POS LOGIC ---
function updateDigitalPreview() {
    const nominal = parseFloat(document.getElementById('digital-nominal').value) || 0;
    const price = parseFloat(document.getElementById('digital-price').value) || 0;
    const profit = price - nominal;
    document.getElementById('preview-digital-profit').innerText = formatRupiah(profit);
}

async function processDigitalSale() {
    const nominal = document.getElementById('digital-nominal').value;
    const hargaJual = parseFloat(document.getElementById('digital-price').value);
    const catatan = document.getElementById('digital-note').value;

    if (isNaN(hargaJual)) {
        return alert('Harga Jual wajib diisi!');
    }

    const btn = document.getElementById('btn-bayar-digital');
    try {
        btn.disabled = true;
        btn.innerText = 'MENYIMPAN...';

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'processDigitalSale',
                nominal,
                hargaJual,
                catatan
            })
        });

        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Transaksi Digital Berhasil Disimpan');
            document.getElementById('digital-nominal').value = '';
            document.getElementById('digital-price').value = '';
            document.getElementById('digital-note').value = '';
            updateDigitalPreview();
            fetchDashboard();
        } else {
            showNotification('Gagal!', res.message, 'error');
        }
    } catch (e) {
        console.error(e);
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
    document.getElementById('preview-fish-total').innerText = formatRupiah(total);
    document.getElementById('preview-fish-profit').innerText = formatRupiah(profit);
}

async function processFishSale() {
    const jenisIkan = document.getElementById('fish-type').value;
    const qtyKg = parseFloat(document.getElementById('fish-qty').value);
    const hargaJual = parseFloat(document.getElementById('fish-price').value);
    const cogsKg = parseFloat(document.getElementById('fish-cogs').value);

    if (!jenisIkan || isNaN(qtyKg) || isNaN(hargaJual) || isNaN(cogsKg)) {
        return alert('Harap isi semua data dengan benar!');
    }

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
            document.getElementById('fish-qty').value = '';
            document.getElementById('fish-price').value = '';
            document.getElementById('fish-cogs').value = '';
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
        if (Array.isArray(data)) renderDailyProfitTable(data, 'daily-profit-table-body');
    } catch (error) { console.error(error); }
}

async function fetchFishProfit() {
    const tableBody = document.getElementById('fish-profit-table-body');
    if (!tableBody) return;
    try {
        const response = await fetch(`${API_URL}?action=getFishProfitStats`);
        const data = await response.json();
        if (Array.isArray(data)) renderDailyProfitTable(data, 'fish-profit-table-body');
    } catch (error) { console.error(error); }
}

async function fetchDigitalProfit() {
    const tableBody = document.getElementById('digital-profit-table-body');
    if (!tableBody) return;
    try {
        const response = await fetch(`${API_URL}?action=getDigitalProfitStats`);
        const data = await response.json();
        if (Array.isArray(data)) renderDailyProfitTable(data, 'digital-profit-table-body');
    } catch (error) { console.error(error); }
}

function renderDailyProfitTable(data, targetId) {
    const tableBody = document.getElementById(targetId);
    if (!tableBody) return;
    tableBody.innerHTML = '';
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

// --- SUPPLIER ANALYSIS LOGIC ---
async function fetchSupplierAnalysis() {
    const tableBody = document.getElementById('supplier-analysis-table-body');
    if (!tableBody) return;
    try {
        const response = await fetch(`${API_URL}?action=getSupplierAnalysis`);
        const data = await response.json();
        if (Array.isArray(data)) renderSupplierAnalysisTable(data);
    } catch (error) { console.error(error); }
}

function renderSupplierAnalysisTable(data) {
    const tableBody = document.getElementById('supplier-analysis-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.forEach(row => {
        const isRecommended = row.isRecommended;
        const tr = document.createElement('tr');
        tr.className = isRecommended ? 'bg-green-50' : '';
        tr.innerHTML = `
            <td class="px-4 py-3 text-xs text-gray-600">${row.item}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${row.supplier}</td>
            <td class="px-4 py-3 text-xs font-bold ${isRecommended ? 'text-green-600' : 'text-gray-400 line-through'}">${formatRupiah(row.hargaPerUnit)} / ${row.unit}</td>
            <td class="px-4 py-3 text-xs text-gray-500">${row.diffText || '-'}</td>
        `;
        tableBody.appendChild(tr);
    });
}

async function handleSupplierSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const formData = {
        action: 'addSupplierTransaction',
        supplier: document.getElementById('sup-nama').value,
        item: document.getElementById('sup-item').value,
        harga: parseFloat(document.getElementById('sup-harga').value),
        qty: parseFloat(document.getElementById('sup-qty').value),
        satuan: document.getElementById('sup-satuan').value,
        namaStandar: document.getElementById('sup-standar').value,
        qtyKonversi: parseFloat(document.getElementById('sup-konversi').value),
        unitDasar: document.getElementById('sup-unit-dasar').value
    };

    try {
        btn.disabled = true;
        btn.innerText = 'MENYIMPAN...';
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(formData) });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Data Supplier Berhasil Disimpan');
            e.target.reset();
            fetchSupplierAnalysis();
        }
    } catch (error) {
        showNotification('Gagal!', 'Gagal menyimpan data supplier', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'SIMPAN DATA BELANJA';
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
        
        // Update POS Dashboard Mini
        const omzetEl = document.getElementById('today-omzet');
        if (omzetEl && stats) {
            const omzetValue = stats.daily ? stats.daily.omzet : (stats.todayOmzet || 0);
            omzetEl.innerText = formatRupiah(omzetValue);
        }

        if (stats.segments) {
            const sWarung = document.getElementById('summary-laba-warung');
            const sFish = document.getElementById('summary-laba-fish');
            const sDigital = document.getElementById('summary-laba-digital');
            if (sWarung) sWarung.innerText = formatRupiah(stats.segments.warung.laba);
            if (sFish) sFish.innerText = formatRupiah(stats.segments.fish.laba);
            if (sDigital) sDigital.innerText = formatRupiah(stats.segments.digital.laba);
        }

        renderDashboard(stats);
    } catch (error) { console.error(error); }
}

function renderDashboard(stats) {
    const container = document.getElementById('dashboard-content');
    const summaryContainer = document.getElementById('dashboard-summary');
    if (!container || !stats) return;

    if (summaryContainer) {
        const totalOmzet = (stats.daily?.omzet || 0) + (stats.segments?.fish?.omzet || 0) + (stats.segments?.digital?.omzet || 0);
        const totalLaba = (stats.daily?.laba || 0) + (stats.segments?.fish?.laba || 0) + (stats.segments?.digital?.laba || 0);
        
        summaryContainer.innerHTML = `
            <div class="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-8 text-white shadow-lg mb-8">
                <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="text-center md:text-left">
                        <p class="text-teal-100 text-xs font-bold uppercase tracking-widest mb-1">Total Omzet Hari Ini</p>
                        <h3 class="text-4xl font-black">${formatRupiah(totalOmzet)}</h3>
                        <p class="text-teal-100 text-sm mt-1">Total Omzet Gabungan</p>
                    </div>
                    <div class="h-px md:h-16 w-full md:w-px bg-white/20"></div>
                    <div class="text-center md:text-left">
                        <p class="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Total Laba Bersih</p>
                        <h3 class="text-4xl font-black text-yellow-300">${formatRupiah(totalLaba)}</h3>
                        <p class="text-teal-100 text-sm mt-1">Keuntungan Semua Segmen</p>
                    </div>
                    <div class="hidden lg:block">
                        <i class="fas fa-chart-line text-6xl text-white/20"></i>
                    </div>
                </div>
            </div>
        `;
    }

    const createCard = (title, data, color) => {
        if (!data) return '';
        const omzet = data.omzet || 0;
        const laba = data.laba || 0;
        const topNama = data.top ? data.top.nama : '-';
        const topQty = data.top ? data.top.qty : 0;
        return `
            <div class="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                <div class="flex items-center mb-3">
                    <div class="w-8 h-8 rounded-lg bg-${color}-100 text-${color}-600 flex items-center justify-center mr-3">
                        <i class="fas ${title === 'Warung' ? 'fa-store' : title === 'Ikan' ? 'fa-fish' : 'fa-mobile-alt'}"></i>
                    </div>
                    <h4 class="text-sm font-bold text-gray-700 uppercase">${title}</h4>
                </div>
                <p class="text-2xl font-black text-gray-800">${formatRupiah(omzet)}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs text-gray-400">Laba Bersih</span>
                    <span class="text-sm font-bold text-${color}-600">${formatRupiah(laba)}</span>
                </div>
                <div class="mt-4 pt-3 border-t border-gray-50">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Produk Terlaris</p>
                    <p class="text-xs text-gray-600 font-medium">${topNama} <span class="text-gray-400">(${topQty})</span></p>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        ${createCard('Warung', stats.segments ? stats.segments.warung : null, 'teal')}
        ${createCard('Ikan', stats.segments ? stats.segments.fish : null, 'blue')}
        ${createCard('Digital', stats.segments ? stats.segments.digital : null, 'purple')}
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
    
    // Gunakan DocumentFragment untuk performa DOM yang lebih baik
    const fragment = document.createDocumentFragment();
    
    // Limit to maximum 16 products for initial display/filter
    const displayData = data.slice(0, 16);
    
    displayData.forEach(p => {
        const sisaStok = p.SISA_STOK || 0;
        const harga = p.Perkiraan_Harga_Rp || 0;
        const nama = p.Nama_Produk || 'Tanpa Nama';
        const isLow = sisaStok < 5;
        const initial = nama.substring(0, 2).toUpperCase();
        
        const card = document.createElement('div');
        card.className = `product-card bg-white p-4 rounded-xl border ${isLow ? 'border-red-500 bg-red-50' : 'border-gray-100'} flex flex-col items-center text-center cursor-pointer hover:shadow-md transition`;
        card.onclick = () => addToCart(p);
        card.innerHTML = `
            <div class="w-10 h-10 ${isLow ? 'bg-red-500' : 'bg-teal-600'} text-white flex items-center justify-center rounded-lg font-bold mb-2">${initial}</div>
            <h3 class="text-xs font-medium text-gray-700 h-8 overflow-hidden">${nama}</h3>
            <p class="text-teal-600 font-bold text-sm">${formatRupiah(harga)}</p>
            <p class="text-[10px] ${isLow ? 'text-red-600 font-bold' : 'text-gray-400'}">Stok: ${sisaStok} ${isLow ? '!' : ''}</p>
        `;
        fragment.appendChild(card);
    });
    
    grid.innerHTML = '';
    grid.appendChild(fragment);
    
    // Update dropdowns secara asinkron agar tidak memblokir render utama
    setTimeout(() => updateStockDropdowns(data), 0);
}

function updateStockDropdowns(data) {
    if (!data) return;
    const selects = ['stock-sku', 'opname-sku'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        let options = '<option value="">Pilih Produk...</option>';
        data.forEach(p => {
            const sku = p.SKU || '';
            const nama = p.Nama_Produk || 'Tanpa Nama';
            const sisaStok = p.SISA_STOK || 0;
            options += `<option value="${sku}">${nama} (Stok: ${sisaStok})</option>`;
        });
        el.innerHTML = options;
    });
}

function addToCart(product) {
    if (!product || !product.SKU) return;
    const existing = cart.find(item => item.SKU === product.SKU);
    const harga = product.Perkiraan_Harga_Rp || 0;
    const nama = product.Nama_Produk || 'Tanpa Nama';
    const satuan = product.Satuan || '';
    if (existing) {
        existing.Qty += 1;
        existing.Total = existing.Qty * existing.Harga_Satuan;
    } else {
        cart.push({ SKU: product.SKU, Nama_Produk: nama, Satuan: satuan, Harga_Satuan: harga, Qty: 1, Total: harga });
    }
    renderCart();
    
    // Bersihkan input pencarian dan reset tampilan produk
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        // Reset tampilan produk ke kategori yang dipilih atau semua produk
        filterProducts();
        // Fokus kembali ke input pencarian
        searchInput.focus();
    }
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
            <div class="flex-1">
                <h4 class="text-xs font-bold">${item.Nama_Produk}</h4>
                <p class="text-[10px] text-gray-400">${item.Qty} x ${formatRupiah(item.Harga_Satuan)}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="updateQty(${index}, -1)" class="text-gray-400 hover:text-red-500"><i class="fas fa-minus-circle"></i></button>
                <span class="text-xs font-bold">${item.Qty}</span>
                <button onclick="updateQty(${index}, 1)" class="text-gray-400 hover:text-green-500"><i class="fas fa-plus-circle"></i></button>
            </div>
        `;
        fragment.appendChild(div);
    });
    
    container.innerHTML = '';
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 text-xs mt-10">Kosong</p>';
    } else {
        container.appendChild(fragment);
    }
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
    if (!btn) return;
    try {
        btn.disabled = true;
        btn.innerText = 'PROSES...';
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ items: cart }) });
        const res = await response.json();
        if (res.status === 'success') {
            showNotification('Berhasil!', 'Transaksi Berhasil Disimpan');
            cart = [];
            renderCart();
            fetchProducts();
            fetchDashboard();
        } else { 
            showNotification('Gagal!', res.message, 'error'); 
        }
    } catch (e) { 
        showNotification('Kesalahan!', 'Gagal memproses pembayaran!', 'error'); 
    }
    finally { btn.disabled = false; btn.innerText = 'BAYAR'; }
}

function filterProducts() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    const search = searchInput.value.toLowerCase();
    const filtered = products.filter(p => {
        const nama = (p.Nama_Produk || '').toLowerCase();
        const sku = (p.SKU || '').toString().toLowerCase();
        const kategori = p.Kategori || '';
        const matchesSearch = nama.includes(search) || sku.includes(search);
        const matchesCategory = selectedCategory === 'Semua' || kategori === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    renderProducts(filtered);
}

function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
}
