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
    
    // Pastikan elemen ada sebelum menambah listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', filterProducts);
    
    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    
    const btnBayar = document.getElementById('btn-bayar');
    if (btnBayar) btnBayar.addEventListener('click', processPayment);
});

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
    showPage('pos');
}

// Ambil Data Produk
async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        products = await response.json();
        renderCategories(products);
        renderProducts(products);
    } catch (error) {
        console.error("Gagal memuat produk:", error);
        if (products && products.length > 0) {
            renderCategories(products);
            renderProducts(products);
        }
    }
}

// Ambil Stats Dashboard
async function fetchDashboard() {
    try {
        const response = await fetch(`${API_URL}?action=getDashboardStats`);
        const stats = await response.json();
        
        const omzetEl = document.getElementById('today-omzet');
        if (omzetEl && stats) {
            const omzetValue = stats.daily ? stats.daily.omzet : (stats.todayOmzet || 0);
            omzetEl.innerText = formatRupiah(omzetValue);
        }
        
        if (stats) updateReportUI(stats);
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
    }
}

function updateReportUI(stats) {
    const container = document.getElementById('report-container');
    if (!container || !stats) return;

    const createCard = (title, data, color) => {
        if (!data) return '';
        const omzet = data.omzet || 0;
        const laba = data.laba || 0;
        const topNama = data.top ? data.top.nama : '-';
        const topQty = data.top ? data.top.qty : 0;
        
        return `
            <div class="bg-${color}-50 p-4 rounded-xl border border-${color}-100">
                <h4 class="text-xs font-bold text-${color}-600 uppercase">${title}</h4>
                <p class="text-xl font-black text-${color}-800">${formatRupiah(omzet)}</p>
                <p class="text-xs text-${color}-500">Laba: ${formatRupiah(laba)}</p>
                <p class="text-[10px] text-gray-500 mt-2 italic">Terlaris: ${topNama} (${topQty})</p>
            </div>
        `;
    };

    container.innerHTML = `
        ${createCard('Hari Ini', stats.daily, 'blue')}
        ${createCard('Minggu Ini', stats.weekly, 'purple')}
        ${createCard('Bulan Ini', stats.monthly, 'orange')}
    `;
}

// Render Kategori
function renderCategories(data) {
    const container = document.getElementById('category-filter');
    if (!container || !data) return;

    const categories = ['Semua', ...new Set(data.map(p => p.Kategori).filter(k => k))];
    container.innerHTML = '';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `px-3 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap min-w-[80px] ${selectedCategory === cat ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-300 hover:text-teal-600'}`;
        btn.innerText = cat;
        btn.onclick = () => {
            selectedCategory = cat;
            renderCategories(data);
            filterProducts();
        };
        container.appendChild(btn);
    });
}

// Tampilkan Produk ke Grid
function renderProducts(data) {
    const grid = document.getElementById('product-grid');
    if (!grid || !data) return;
    grid.innerHTML = '';
    
    data.forEach(p => {
        const sisaStok = p.SISA_STOK || 0;
        const harga = p.Perkiraan_Harga_Rp || 0;
        const nama = p.Nama_Produk || 'Tanpa Nama';
        
        const isLow = sisaStok < 5;
        const initial = nama.substring(0, 2).toUpperCase();
        
        const card = document.createElement('div');
        card.className = `product-card bg-white p-4 rounded-xl border ${isLow ? 'border-red-500 bg-red-50' : 'border-gray-100'} flex flex-col items-center text-center cursor-pointer hover:shadow-md transition`;
        card.onclick = () => addToCart(p);
        
        card.innerHTML = `
            <div class="w-10 h-10 ${isLow ? 'bg-red-500' : 'bg-teal-600'} text-white flex items-center justify-center rounded-lg font-bold mb-2">
                ${initial}
            </div>
            <h3 class="text-xs font-medium text-gray-700 h-8 overflow-hidden">${nama}</h3>
            <p class="text-teal-600 font-bold text-sm">${formatRupiah(harga)}</p>
            <p class="text-[10px] ${isLow ? 'text-red-600 font-bold' : 'text-gray-400'}">Stok: ${sisaStok} ${isLow ? '!' : ''}</p>
        `;
        grid.appendChild(card);
    });
    updateStockDropdowns(data);
}

function updateStockDropdowns(data) {
    if (!data) return;
    const selects = ['stock-sku', 'opname-sku'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<option value="">Pilih Produk...</option>';
        data.forEach(p => {
            const sku = p.SKU || '';
            const nama = p.Nama_Produk || 'Tanpa Nama';
            const sisaStok = p.SISA_STOK || 0;
            el.innerHTML += `<option value="${sku}">${nama} (Stok: ${sisaStok})</option>`;
        });
    });
}

// Tambah ke Keranjang
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
        cart.push({
            SKU: product.SKU,
            Nama_Produk: nama,
            Satuan: satuan,
            Harga_Satuan: harga,
            Qty: 1,
            Total: harga
        });
    }
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    if (!container || !totalEl) return;
    
    container.innerHTML = '';
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
        container.appendChild(div);
    });
    
    if (cart.length === 0) container.innerHTML = '<p class="text-center text-gray-400 text-xs mt-10">Kosong</p>';
    totalEl.innerText = formatRupiah(total);
}

function updateQty(index, delta) {
    if (index < 0 || index >= cart.length) return;
    cart[index].Qty += delta;
    if (cart[index].Qty <= 0) cart.splice(index, 1);
    else cart[index].Total = cart[index].Qty * cart[index].Harga_Satuan;
    renderCart();
}

function clearCart() {
    if (confirm('Bersihkan keranjang?')) {
        cart = [];
        renderCart();
    }
}

async function processPayment() {
    if (cart.length === 0) return alert('Keranjang kosong!');
    const btn = document.getElementById('btn-bayar');
    if (!btn) return;
    
    try {
        btn.disabled = true;
        btn.innerText = 'PROSES...';
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ items: cart })
        });
        const res = await response.json();
        if (res.status === 'success') {
            alert('Transaksi Berhasil! ID: ' + res.trxId);
            cart = [];
            renderCart();
            fetchProducts();
            fetchDashboard();
        } else {
            alert('Gagal: ' + (res.message || 'Terjadi kesalahan'));
        }
    } catch (e) { 
        console.error(e);
        alert('Gagal memproses pembayaran!'); 
    }
    finally { 
        btn.disabled = false; 
        btn.innerText = 'BAYAR'; 
    }
}

async function processStockAction(type) {
    const skuEl = document.getElementById(type === 'restock' ? 'stock-sku' : 'opname-sku');
    const qtyEl = document.getElementById(type === 'restock' ? 'stock-qty' : 'opname-qty');
    const modalEl = type === 'restock' ? document.getElementById('stock-modal') : null;
    const alasanEl = document.getElementById(type === 'restock' ? 'stock-alasan' : 'opname-alasan');

    if (!skuEl || !qtyEl) return;

    const sku = skuEl.value;
    const qty = qtyEl.value;
    const modal = modalEl ? modalEl.value : null;
    const alasan = alasanEl ? alasanEl.value : '';

    if (!sku || !qty) return alert('Lengkapi data!');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: type, sku, qty, modalBaru: modal, alasan })
        });
        const res = await response.json();
        if (res.status === 'success') {
            alert('Stok berhasil diperbarui!');
            fetchProducts(); // Refresh data tanpa reload halaman
            // Clear inputs
            qtyEl.value = '';
            if (modalEl) modalEl.value = '';
            if (alasanEl) alasanEl.value = '';
        } else {
            alert('Gagal: ' + (res.message || 'Terjadi kesalahan'));
        }
    } catch (e) { 
        console.error(e);
        alert('Gagal memperbarui stok!'); 
    }
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
