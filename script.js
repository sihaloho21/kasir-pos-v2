const API_URL = "https://script.google.com/macros/s/AKfycbxz260m0RdQa2YNBVzt7RU7PQG3ZeaVwr6VmTGQEfF18FVFxTmtbBEkMOIQ1y_ZkuKc/exec";

let products = [];
let cart = [];

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
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
    event.currentTarget.classList.add('bg-teal-700');
}

// Ambil Data Produk
async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        products = await response.json();
        renderProducts(products);
    } catch (error) {
        console.error("Gagal memuat produk:", error);
    }
}

// Ambil Stats Dashboard
async function fetchDashboard() {
    try {
        const response = await fetch(`${API_URL}?action=getDashboardStats`);
        const stats = await response.json();
        
        const omzetEl = document.getElementById('today-omzet');
        if (omzetEl) omzetEl.innerText = formatRupiah(stats.daily ? stats.daily.omzet : stats.todayOmzet);
        
        // Update laporan jika elemennya ada
        updateReportUI(stats);
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
    }
}

function updateReportUI(stats) {
    const container = document.getElementById('report-container');
    if (!container) return;

    const createCard = (title, data, color) => `
        <div class="bg-${color}-50 p-4 rounded-xl border border-${color}-100">
            <h4 class="text-xs font-bold text-${color}-600 uppercase">${title}</h4>
            <p class="text-xl font-black text-${color}-800">${formatRupiah(data.omzet)}</p>
            <p class="text-xs text-${color}-500">Laba: ${formatRupiah(data.laba)}</p>
            <p class="text-[10px] text-gray-500 mt-2 italic">Terlaris: ${data.top.nama} (${data.top.qty})</p>
        </div>
    `;

    container.innerHTML = `
        ${createCard('Hari Ini', stats.daily, 'blue')}
        ${createCard('Minggu Ini', stats.weekly, 'purple')}
        ${createCard('Bulan Ini', stats.monthly, 'orange')}
    `;
}

// Tampilkan Produk ke Grid
function renderProducts(data) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    data.forEach(p => {
        const isLow = p.SISA_STOK < 5;
        const initial = p.Nama_Produk.substring(0, 2).toUpperCase();
        
        const card = document.createElement('div');
        card.className = `product-card bg-white p-4 rounded-xl border ${isLow ? 'border-red-500 bg-red-50' : 'border-gray-100'} flex flex-col items-center text-center cursor-pointer hover:shadow-md transition`;
        card.onclick = () => addToCart(p);
        
        card.innerHTML = `
            <div class="w-10 h-10 ${isLow ? 'bg-red-500' : 'bg-teal-600'} text-white flex items-center justify-center rounded-lg font-bold mb-2">
                ${initial}
            </div>
            <h3 class="text-xs font-medium text-gray-700 h-8 overflow-hidden">${p.Nama_Produk}</h3>
            <p class="text-teal-600 font-bold text-sm">${formatRupiah(p.Perkiraan_Harga_Rp)}</p>
            <p class="text-[10px] ${isLow ? 'text-red-600 font-bold' : 'text-gray-400'}">Stok: ${p.SISA_STOK} ${isLow ? '!' : ''}</p>
        `;
        grid.appendChild(card);
    });
    updateStockDropdowns(data);
}

function updateStockDropdowns(data) {
    const selects = ['stock-sku', 'opname-sku'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<option value="">Pilih Produk...</option>';
        data.forEach(p => {
            el.innerHTML += `<option value="${p.SKU}">${p.Nama_Produk} (Stok: ${p.SISA_STOK})</option>`;
        });
    });
}

// Tambah ke Keranjang
function addToCart(product) {
    const existing = cart.find(item => item.SKU === product.SKU);
    if (existing) {
        existing.Qty += 1;
        existing.Total = existing.Qty * existing.Harga_Satuan;
    } else {
        cart.push({
            SKU: product.SKU,
            Nama_Produk: product.Nama_Produk,
            Satuan: product.Satuan,
            Harga_Satuan: product.Perkiraan_Harga_Rp,
            Qty: 1,
            Total: product.Perkiraan_Harga_Rp
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
        }
    } catch (e) { alert('Gagal!'); }
    finally { btn.disabled = false; btn.innerText = 'BAYAR'; }
}

async function processStockAction(type) {
    const sku = document.getElementById(type === 'restock' ? 'stock-sku' : 'opname-sku').value;
    const qty = document.getElementById(type === 'restock' ? 'stock-qty' : 'opname-qty').value;
    const modal = type === 'restock' ? document.getElementById('stock-modal').value : null;
    const alasan = document.getElementById(type === 'restock' ? 'stock-alasan' : 'opname-alasan').value;

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
        }
    } catch (e) { alert('Gagal!'); }
}

function filterProducts() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const filtered = products.filter(p => p.Nama_Produk.toLowerCase().includes(search) || p.SKU.toString().includes(search));
    renderProducts(filtered);
}

function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
}
