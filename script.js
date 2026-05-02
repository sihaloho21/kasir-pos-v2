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
    
    // Pastikan elemen ada sebelum menambah listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', filterProducts);
    
    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    
    const btnBayar = document.getElementById('btn-bayar');
    if (btnBayar) btnBayar.addEventListener('click', processPayment);

    // Fish POS Listeners
    ['fish-qty', 'fish-price', 'fish-cogs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateFishPreview);
    });
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

    // Load reports if switching to report page
    if (pageId === 'report') {
        fetchDailyProfit();
        fetchFishProfit();
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
    showPage('pos');
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
            body: JSON.stringify({
                action: 'processFishSale',
                jenisIkan,
                qtyKg,
                hargaJual,
                cogsKg
            })
        });

        const res = await response.json();
        if (res.status === 'success') {
            alert('Transaksi Ikan Berhasil Disimpan!');
            // Reset fields
            document.getElementById('fish-qty').value = '';
            document.getElementById('fish-price').value = '';
            document.getElementById('fish-cogs').value = '';
            updateFishPreview();
            fetchDashboard();
        } else {
            alert('Gagal: ' + res.message);
        }
    } catch (e) {
        console.error(e);
        alert('Terjadi kesalahan koneksi!');
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
            renderDailyProfitTable(data, 'daily-profit-table-body');
        }
    } catch (error) {
        console.error("Gagal memuat laporan laba harian:", error);
    }
}

async function fetchFishProfit() {
    const tableBody = document.getElementById('fish-profit-table-body');
    if (!tableBody) return;

    try {
        const response = await fetch(`${API_URL}?action=getFishProfitStats`);
        const data = await response.json();
        if (Array.isArray(data)) {
            renderDailyProfitTable(data, 'fish-profit-table-body');
        }
    } catch (error) {
        console.error("Gagal memuat laporan laba ikan:", error);
    }
}

function renderDailyProfitTable(data, targetId) {
    const tableBody = document.getElementById(targetId);
    if (!tableBody) return;

    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400 italic">Belum ada data.</td></tr>';
        return;
    }

    tableBody.innerHTML = data.map(row => `
        <tr class="hover:bg-gray-50 border-b border-gray-100 transition">
            <td class="p-3 font-medium text-gray-600">${formatDateShort(row.tanggal)}</td>
            <td class="p-3">${formatRupiah(row.omzet)}</td>
            <td class="p-3 font-bold ${row.laba >= 0 ? 'text-green-600' : 'text-red-600'}">${formatRupiah(row.laba)}</td>
        </tr>
    `).join('');
}

function formatDateShort(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', options);
}

// --- CORE POS LOGIC ---

async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        products = await response.json();
        renderCategories(products);
        renderProducts(products);
    } catch (error) {
        console.error("Gagal memuat produk:", error);
    }
}

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
                <p class="text-xs text-${color}-500 font-bold">Laba Bersih: ${formatRupiah(laba)}</p>
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
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ items: cart }) });
        const res = await response.json();
        if (res.status === 'success') {
            alert('Transaksi Berhasil!');
            cart = [];
            renderCart();
            fetchProducts();
            fetchDashboard();
        } else {
            alert('Gagal: ' + res.message);
        }
    } catch (e) {
        alert('Gagal memproses pembayaran!');
    } finally {
        btn.disabled = false;
        btn.innerText = 'BAYAR';
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
