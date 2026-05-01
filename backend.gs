/**
 * GOOGLE APPS SCRIPT BACKEND FOR POS SYSTEM (AUTO-SETUP VERSION)
 * Fitur: Auto-create Sheets, Get Data Produk, Proses Transaksi, Update Stok, Update Rekap
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

// Nama Sheet dan Header Kolom
const CONFIG = {
  PRODUK: {
    name: 'PRODUK',
    headers: ['SKU', 'Kategori', 'Nama Produk', 'Harga Modal (Rp)', 'Satuan', 'Perkiraan Harga (Rp)', 'STOK', 'SISA STOK', 'MODAL BARANG', 'SUPLIER']
  },
  PENJUALAN: {
    name: 'Penjualan',
    headers: ['ID Transaksi', 'Tanggal', 'SKU', 'Nama Produk', 'Satuan', 'Harga Satuan (Rp)', 'Qty', 'Total (Rp)']
  },
  REKAP: {
    name: 'Rekap Produk',
    headers: ['SKU', 'Nama Produk', 'Satuan', 'Harga Modal (Rp)', 'Harga Jual (Rp)', 'Qty Terjual', 'Omzet (Rp)', 'HPP (Rp)', 'Laba Kotor (Rp)']
  },
  LOG_STOK: {
    name: 'Log_Stok',
    headers: ['Tanggal', 'SKU', 'Nama Produk', 'Tipe', 'Jumlah', 'Alasan', 'Stok Akhir']
  }
};

/**
 * FUNGSI UTAMA UNTUK SETUP OTOMATIS
 * Jalankan fungsi ini sekali (Klik tombol 'Run' di editor GAS)
 */
function setupSheets() {
  Object.keys(CONFIG).forEach(key => {
    const sheetConfig = CONFIG[key];
    let sheet = SS.getSheetByName(sheetConfig.name);
    
    if (!sheet) {
      sheet = SS.insertSheet(sheetConfig.name);
      sheet.appendRow(sheetConfig.headers);
      // Beri format tebal pada header
      sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      Logger.log('Sheet ' + sheetConfig.name + ' berhasil dibuat.');
    } else {
      Logger.log('Sheet ' + sheetConfig.name + ' sudah ada.');
    }
  });
  return "Setup Selesai! Silakan cek Spreadsheet Anda.";
}

// 1. Fungsi untuk melayani permintaan dari Frontend (Web App)
function doGet(e) {
  setupSheets(); // Pastikan sheet ada saat diakses
  const action = e.parameter.action;
  
  if (action === 'getProducts') {
    return createResponse(getProductsData());
  }
  
  if (action === 'getDashboardStats') {
    return createResponse(getDashboardStats());
  }

  return createResponse({ status: 'error', message: 'Action not found' });
}

// 2. Fungsi untuk menerima data transaksi (POST)
function doPost(e) {
  setupSheets(); // Pastikan sheet ada saat diakses
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'restock' || data.action === 'opname') {
      return createResponse(handleStockAction(data));
    }
    const result = processTransaction(data);
    return createResponse(result);
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

// --- FUNGSI LOGIKA ---

function getProductsData() {
  const sheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      // Ubah spasi jadi underscore untuk kemudahan di JS Frontend
      const key = header.replace(/\s+/g, '_').replace(/[()]/g, '');
      obj[key] = row[i];
    });
    return obj;
  });
}

function processTransaction(payload) {
  const { items } = payload;
  const sheetPenjualan = SS.getSheetByName(CONFIG.PENJUALAN.name);
  const timestamp = new Date();
  const dateStr = Utilities.formatDate(timestamp, "GMT+7", "yyyy-MM-dd HH:mm:ss");
  const trxId = "TRX-" + Utilities.formatDate(timestamp, "GMT+7", "yyyyMMdd") + "-" + Math.floor(1000 + Math.random() * 9000);

  items.forEach(item => {
    // 1. Catat Penjualan
    sheetPenjualan.appendRow([
      trxId,
      dateStr,
      item.SKU,
      item.Nama_Produk,
      item.Satuan,
      item.Harga_Satuan,
      item.Qty,
      item.Total
    ]);

    // 2. Update Stok
    updateStock(item.SKU, item.Qty);

    // 3. Update Rekap
    updateRekap(item);
  });

  return { status: 'success', trxId: trxId };
}

function updateStock(sku, qtySold) {
  const sheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == sku) { 
      const currentSisaStok = data[i][7] || 0; 
      sheet.getRange(i + 1, 8).setValue(currentSisaStok - qtySold);
      break;
    }
  }
}

function updateRekap(item) {
  const sheet = SS.getSheetByName(CONFIG.REKAP.name);
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == item.SKU) {
      const currentQty = Number(data[i][5]) || 0;
      const currentOmzet = Number(data[i][6]) || 0;
      const currentHPP = Number(data[i][7]) || 0;
      const modal = Number(data[i][3]) || 0;
      
      const newQty = currentQty + item.Qty;
      const newOmzet = currentOmzet + item.Total;
      const newHPP = currentHPP + (modal * item.Qty);
      const newLaba = newOmzet - newHPP;

      sheet.getRange(i + 1, 6).setValue(newQty);
      sheet.getRange(i + 1, 7).setValue(newOmzet);
      sheet.getRange(i + 1, 8).setValue(newHPP);
      sheet.getRange(i + 1, 9).setValue(newLaba);
      found = true;
      break;
    }
  }
  
  if (!found) {
    // Jika SKU belum ada di rekap, ambil data modal dari sheet PRODUK
    const produkData = SS.getSheetByName(CONFIG.PRODUK.name).getDataRange().getValues();
    let modal = 0;
    for(let j=1; j<produkData.length; j++) {
      if(produkData[j][0] == item.SKU) {
        modal = produkData[j][3];
        break;
      }
    }
    const hpp = modal * item.Qty;
    sheet.appendRow([item.SKU, item.Nama_Produk, item.Satuan, modal, item.Harga_Satuan, item.Qty, item.Total, hpp, item.Total - hpp]);
  }
}

function getDashboardStats() {
  const sheetPenjualan = SS.getSheetByName(CONFIG.PENJUALAN.name);
  const data = sheetPenjualan.getDataRange().getValues();
  const headers = data.shift();
  
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
  
  // Helper untuk cek periode
  const isToday = (d) => Utilities.formatDate(d, "GMT+7", "yyyy-MM-dd") === todayStr;
  const isThisWeek = (d) => {
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    return d >= startOfWeek;
  };
  const isThisMonth = (d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

  let stats = {
    daily: { omzet: 0, laba: 0, items: {} },
    weekly: { omzet: 0, laba: 0, items: {} },
    monthly: { omzet: 0, laba: 0, items: {} }
  };

  // Ambil data modal dari sheet Rekap untuk hitung laba bersih
  const rekapData = SS.getSheetByName(CONFIG.REKAP.name).getDataRange().getValues();
  rekapData.shift();
  let modalMap = {};
  rekapData.forEach(r => modalMap[r[0]] = r[3]); // SKU -> Harga Modal

  data.forEach(row => {
    const tgl = new Date(row[1]);
    const sku = row[2];
    const nama = row[3];
    const qty = Number(row[6]);
    const total = Number(row[7]);
    const modal = modalMap[sku] || 0;
    const laba = total - (modal * qty);

    const updateStat = (period) => {
      stats[period].omzet += total;
      stats[period].laba += laba;
      if (!stats[period].items[nama]) stats[period].items[nama] = 0;
      stats[period].items[nama] += qty;
    };

    if (isToday(tgl)) updateStat('daily');
    if (isThisWeek(tgl)) updateStat('weekly');
    if (isThisMonth(tgl)) updateStat('monthly');
  });

  // Helper untuk cari produk terlaris
  const getTopProduct = (items) => {
    let top = { nama: "-", qty: 0 };
    for (let name in items) {
      if (items[name] > top.qty) top = { nama: name, qty: items[name] };
    }
    return top;
  };

  return {
    daily: { ...stats.daily, top: getTopProduct(stats.daily.items) },
    weekly: { ...stats.weekly, top: getTopProduct(stats.weekly.items) },
    monthly: { ...stats.monthly, top: getTopProduct(stats.monthly.items) }
  };
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Fungsi Baru untuk Mencatat Log Stok
function logStockChange(sku, nama, tipe, jumlah, alasan, stokAkhir) {
  const sheet = SS.getSheetByName(CONFIG.LOG_STOK.name);
  sheet.appendRow([new Date(), sku, nama, tipe, jumlah, alasan, stokAkhir]);
}

// Fungsi untuk Restock & Opname
function handleStockAction(payload) {
  const { action, sku, qty, modalBaru, alasan } = payload;
  const sheetProduk = SS.getSheetByName(CONFIG.PRODUK.name);
  const data = sheetProduk.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == sku) {
      let currentTotalStok = Number(data[i][6]) || 0;
      let currentSisaStok = Number(data[i][7]) || 0;
      let newSisaStok = currentSisaStok;
      let newTotalStok = currentTotalStok;

      if (action === 'restock') {
        newTotalStok += Number(qty);
        newSisaStok += Number(qty);
        if (modalBaru) sheetProduk.getRange(i + 1, 4).setValue(modalBaru); // Update Harga Modal
      } else if (action === 'opname') {
        newSisaStok = Number(qty); // Set stok sesuai fisik
      }

      sheetProduk.getRange(i + 1, 7).setValue(newTotalStok);
      sheetProduk.getRange(i + 1, 8).setValue(newSisaStok);
      
      logStockChange(sku, data[i][2], action.toUpperCase(), qty, alasan, newSisaStok);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'SKU tidak ditemukan' };
}
