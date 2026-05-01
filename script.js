const API_URL = "https://script.google.com/macros/s/AKfycbxz260m0RdQa2YNBVzt7RU7PQG3ZeaVwr6VmTGQEfF18FVFxTmtbBEkMOIQ1y_ZkuKc/exec";

let products = [];
let cart = [];

// Inisialisasi
document.addEventListener('DOMContentLoaded', ( ) => {
    fetchProducts();
    fetchDashboard();
    
    document.getElementById('search-input').addEventListener('input', filterProducts);
    document.getElementById('category-filter').addEventListener('change', filterProducts);
    document.getElementById('clear-cart').addEventListener('click', clearCart);
    document.getElementById('btn-bayar').addEventListener('click', processPayment);
});

// Ambil Data Produk
async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        products = await response.json();
        renderProducts(products);
        renderCategories();
    } catch (error) {
        console.error("Gagal memuat produk:", error);
    }
}

// Ambil Stats Dashboard
async function fetchDashboard() {
    try {
        const response = await fetch(`${API_URL}?action=getDashboardStats`);
        const stats = await response.json();
        
        // Update UI Laporan
        document.getElementById('today-omzet').innerText = formatRupiah(stats.daily.omzet);
        
        // Daily
        document.getElementById('rep-daily-omzet').innerText = formatRupiah(stats.daily.omzet);
        document.getElementById('rep-daily-laba').innerText = formatRupiah(stats.daily.laba);
        document.getElementById('rep-daily-top').innerText = `${stats.daily.top.nama} (${stats.daily.top.qty})`;
        
        // Weekly
        document.getElementById('rep-weekly-omzet').innerText = formatRupiah(stats.weekly.omzet);
        document.getElementById('rep-weekly-laba').innerText = formatRupiah(stats.weekly.laba);
        document.getElementById('rep-weekly-top').innerText = `${stats.weekly.top.nama} (${stats.weekly.top.qty})`;
        
        // Monthly
        document.getElementById('rep-monthly-omzet').innerText = formatRupiah(stats.monthly.omzet);
        document.getElementById('rep-monthly-laba').innerText = formatRupiah(stats.monthly.laba);
        document.getElementById('rep-monthly-top').innerText = `${stats.monthly.top.nama} (${stats.monthly.top.qty})`;
        
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
    }
}


// Tampilkan Produk ke Grid
function renderProducts(data) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    
    data.forEach(p => {
        // Ambil inisial nama produk
        const initial = p.Nama_Produk.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        const card = document.createElement('div');
        card.className = "product-card bg-white p-4 rounded-xl border border-gray-100 flex flex-col items-center text-center space-y-2";
        card.onclick = () => addToCart(p);
        
        card.innerHTML = `
            <div class="w-12 h-12 bg-teal-600 text-white flex items-center justify-center rounded-lg font-bold mb-2">
                ${initial}
            </div>
            <h3 class="text-sm font-medium text-gray-700 leading-tight h-10 overflow-hidden">${p.Nama_Produk}</h3>
            <p class="text-teal-600 font-bold text-sm">${formatRupiah(p.Perkiraan_Harga_Rp)}</p>
            <p class="text-[10px] text-gray-400">Stok: ${p.SISA_STOK}</p>
        `;
        grid.appendChild(card);
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

// Update Tampilan Keranjang
function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    container.innerHTML = '';
    
    let total = 0;
    cart.forEach((item, index) => {
        total += item.Total;
        const div = document.createElement('div');
        div.className = "flex justify-between items-start border-b border-gray-50 pb-3";
        div.innerHTML = `
            <div class="flex-1">
                <h4 class="text-sm font-bold text-gray-800">${item.Nama_Produk}</h4>
                <div class="flex items-center mt-2 space-x-3">
                    <div class="flex items-center border border-gray-200 rounded-md">
                        <button onclick="updateQty(${index}, -1)" class="px-2 py-1 text-gray-500 hover:bg-gray-100">-</button>
                        <span class="px-3 py-1 text-xs font-bold">${item.Qty}</span>
                        <button onclick="updateQty(${index}, 1)" class="px-2 py-1 text-gray-500 hover:bg-gray-100">+</button>
                    </div>
                    <span class="text-[10px] text-gray-400">@ ${formatRupiah(item.Harga_Satuan)}</span>
                </div>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold text-teal-600">${formatRupiah(item.Total)}</p>
            </div>
        `;
        container.appendChild(div);
    });
    
    if (cart.length === 0) container.innerHTML = '<p class="text-center text-gray-400 mt-10">Keranjang kosong</p>';
    totalEl.innerText = formatRupiah(total);
}

function updateQty(index, delta) {
    cart[index].Qty += delta;
    if (cart[index].Qty <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].Total = cart[index].Qty * cart[index].Harga_Satuan;
    }
    renderCart();
}

function clearCart() {
    if (confirm('Batalkan transaksi ini?')) {
        cart = [];
        renderCart();
    }
}

// Proses Pembayaran
async function processPayment() {
    if (cart.length === 0) return alert('Keranjang masih kosong!');
    
    const btn = document.getElementById('btn-bayar');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> MEMPROSES...';
        
        const payload = {
            items: cart,
            totalAmount: cart.reduce((sum, i) => sum + i.Total, 0)
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showModal(`
                <div class="text-green-500 text-5xl mb-4"><i class="fas fa-check-circle"></i></div>
                <h2 class="text-xl font-bold mb-2">Transaksi Berhasil!</h2>
                <p class="text-gray-500 mb-4">ID: ${result.trxId}</p>
                <button onclick="closeModal()" class="bg-green-500 text-white px-6 py-2 rounded-lg font-bold">Selesai</button>
            `);
            cart = [];
            renderCart();
            fetchProducts(); // Refresh stok
            fetchDashboard(); // Refresh omzet
        }
    } catch (error) {
        alert('Gagal memproses transaksi. Periksa koneksi atau URL Apps Script.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Utility
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

function filterProducts() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    
    const filtered = products.filter(p => {
        const matchSearch = p.Nama_Produk.toLowerCase().includes(search) || p.SKU.toString().includes(search);
        const matchCategory = category === "" || p.Kategori === category;
        return matchSearch && matchCategory;
    });
    renderProducts(filtered);
}

function renderCategories() {
    const select = document.getElementById('category-filter');
    const cats = [...new Set(products.map(p => p.Kategori))];
    cats.forEach(c => {
        if (!c) return;
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = c;
        select.appendChild(opt);
    });
}

// Tambahkan fungsi ini di script.js
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('bg-teal-700', 'active'));
    
    document.getElementById('page-' + pageId).classList.remove('hidden');
    event.currentTarget.classList.add('bg-teal-700');
}

// Update renderProducts untuk notifikasi stok menipis
function renderProducts(data) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    data.forEach(p => {
        const isLow = p.SISA_STOK < 5; // Batas stok menipis
        const card = document.createElement('div');
        card.className = `product-card bg-white p-4 rounded-xl border ${isLow ? 'border-red-500 bg-red-50' : 'border-gray-100'} flex flex-col items-center text-center`;
        card.onclick = () => addToCart(p);
        card.innerHTML = `
            <div class="${isLow ? 'bg-red-500' : 'bg-teal-600'} text-white p-2 rounded mb-2 font-bold">${p.Nama_Produk.substring(0,2).toUpperCase()}</div>
            <h3 class="text-xs font-bold">${p.Nama_Produk}</h3>
            <p class="text-teal-600 font-bold">${formatRupiah(p.Perkiraan_Harga_Rp)}</p>
            <p class="text-[10px] ${isLow ? 'text-red-600 font-bold' : 'text-gray-400'}">Stok: ${p.SISA_STOK} ${isLow ? '(MENIPIS!)' : ''}</p>
        `;
        grid.appendChild(card);
    });
    updateStockDropdowns(data);
}

function updateStockDropdowns(data) {
    const selects = ['stock-sku', 'opname-sku'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = '<option value="">Pilih Produk...</option>';
        data.forEach(p => {
            el.innerHTML += `<option value="${p.SKU}">${p.Nama_Produk} (Stok: ${p.SISA_STOK})</option>`;
        });
    });
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
            alert('Data stok berhasil diperbarui!');
            location.reload(); // Refresh data
        }
    } catch (e) { alert('Gagal memperbarui stok'); }
}


function showModal(html) {
    const m = document.getElementById('modal');
    document.getElementById('modal-content').innerHTML = html;
    m.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}
