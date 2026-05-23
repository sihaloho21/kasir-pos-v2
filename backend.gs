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
  },
  PENJUALAN_IKAN: {
    name: 'Penjualan_Ikan',
    headers: ['Tanggal Terjual', 'Jenis Ikan', 'Jumlah Terjual (kg)', 'Harga Jual per Kg', 'Total Harga Jual', 'COGS per Kg (Avg Beli)', 'Total COGS', 'Total Keuntungan']
  },
  PRODUK_DIGITAL: {
    name: 'Produk_Digital',
    headers: ['TANGGAL', 'NOMINAL', 'HARGA JUAL', 'KEUNTUNGAN', 'CATATAN']
  }
};

/**
 * FUNGSI UTAMA UNTUK SETUP OTOMATIS
 */
function setupSheets() {
  Object.keys(CONFIG).forEach(key => {
    const sheetConfig = CONFIG[key];
    let sheet = SS.getSheetByName(sheetConfig.name);
    
    if (!sheet) {
      sheet = SS.insertSheet(sheetConfig.name);
      sheet.appendRow(sheetConfig.headers);
      sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    }
  });
  return "Setup Selesai!";
}

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getProducts') return createResponse(getProductsData());
    if (action === 'getDashboardStats') return createResponse(getDashboardStats());
    if (action === 'getDailyProfitStats') return createResponse(getDailyProfitStats());
    if (action === 'getFishProfitStats') return createResponse(getFishProfitStats());
    if (action === 'getDigitalProfitStats') return createResponse(getDigitalProfitStats());
    return createResponse({ status: 'error', message: 'Action not found' });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'restock' || data.action === 'opname') return createResponse(handleStockAction(data));
    if (data.action === 'processFishSale') return createResponse(processFishSale(data));
    if (data.action === 'processDigitalSale') return createResponse(processDigitalSale(data));
    return createResponse(processTransaction(data));
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// --- FUNGSI LOGIKA ---

function getProductsData() {
  const sheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  const penjualanSheet = SS.getSheetByName(CONFIG.PENJUALAN.name);
  const penjualanData = penjualanSheet ? penjualanSheet.getDataRange().getValues() : [];
  if (penjualanData.length) penjualanData.shift();
  const todaySoldQtyMap = {};
  penjualanData.forEach(row => {
    const soldDate = Utilities.formatDate(new Date(row[1]), "GMT+7", "yyyy-MM-dd");
    if (soldDate !== todayStr) return;

    const sku = row[2];
    todaySoldQtyMap[sku] = (todaySoldQtyMap[sku] || 0) + (Number(row[6]) || 0);
  });

  return data.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      const key = header.replace(/\s+/g, '_').replace(/[()]/g, '');
      obj[key] = row[i];
    });
    obj.Qty_Terjual = todaySoldQtyMap[obj.SKU] || 0;
    return obj;
  });
}

function processTransaction(payload) {
  const { items } = payload;
  if (!items || items.length === 0) return { status: 'error', message: 'Keranjang kosong' };
  
  const sheetPenjualan = SS.getSheetByName(CONFIG.PENJUALAN.name);
  const timestamp = new Date();
  const dateStr = Utilities.formatDate(timestamp, "GMT+7", "yyyy-MM-dd HH:mm:ss");
  const trxId = "TRX-" + Utilities.formatDate(timestamp, "GMT+7", "yyyyMMdd") + "-" + Math.floor(1000 + Math.random() * 9000);

  items.forEach(item => {
    sheetPenjualan.appendRow([trxId, dateStr, item.SKU, item.Nama_Produk, item.Satuan, item.Harga_Satuan, item.Qty, item.Total]);
    updateStock(item.SKU, item.Qty);
    updateRekap(item);
  });

  return { status: 'success', trxId: trxId };
}

function updateStock(sku, qtySold) {
  const sheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == sku) { 
      const currentSisaStok = Number(data[i][7]) || 0; 
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

      sheet.getRange(i + 1, 6).setValue(newQty);
      sheet.getRange(i + 1, 7).setValue(newOmzet);
      sheet.getRange(i + 1, 8).setValue(newHPP);
      sheet.getRange(i + 1, 9).setValue(newOmzet - newHPP);
      found = true;
      break;
    }
  }
  
  if (!found) {
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
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
  
  const sheetPenjualan = SS.getSheetByName(CONFIG.PENJUALAN.name);
  const data = sheetPenjualan.getDataRange().getValues();
  data.shift();
  
  const rekapData = SS.getSheetByName(CONFIG.REKAP.name).getDataRange().getValues();
  rekapData.shift();
  let modalMap = {};
  rekapData.forEach(r => modalMap[r[0]] = r[3]);

  let stats = { daily: { omzet: 0, laba: 0, items: {} } };

  data.forEach(row => {
    const tgl = new Date(row[1]);
    if (Utilities.formatDate(tgl, "GMT+7", "yyyy-MM-dd") === todayStr) {
      const sku = row[2];
      const nama = row[3];
      const qty = Number(row[6]);
      const total = Number(row[7]);
      const modal = modalMap[sku] || 0;
      const laba = total - (modal * qty);

      stats.daily.omzet += total;
      stats.daily.laba += laba;
      stats.daily.items[nama] = (stats.daily.items[nama] || 0) + qty;
    }
  });

  const getTop = (items) => {
    let top = { nama: "-", qty: 0 };
    for (let n in items) if (items[n] > top.qty) top = { nama: n, qty: items[n] };
    return top;
  };

  const fishStats = getFishProfitStats();
  const fishToday = fishStats.find(s => s.tanggal === todayStr) || { omzet: 0, laba: 0 };
  const digitalStats = getDigitalProfitStats();
  const digitalToday = digitalStats.find(s => s.tanggal === todayStr) || { omzet: 0, laba: 0 };

  return {
    daily: { ...stats.daily, top: getTop(stats.daily.items) },
    segments: {
      warung: { omzet: stats.daily.omzet, laba: stats.daily.laba },
      fish: { omzet: fishToday.omzet, laba: fishToday.laba },
      digital: { omzet: digitalToday.omzet, laba: digitalToday.laba }
    }
  };
}

function getDailyProfitStats() {
  const sheet = SS.getSheetByName(CONFIG.PENJUALAN.name);
  const data = sheet.getDataRange().getValues();
  data.shift();
  
  const rekapData = SS.getSheetByName(CONFIG.REKAP.name).getDataRange().getValues();
  rekapData.shift();
  let modalMap = {};
  rekapData.forEach(r => modalMap[r[0]] = r[3]);

  let daily = {};
  data.forEach(row => {
    const d = Utilities.formatDate(new Date(row[1]), "GMT+7", "yyyy-MM-dd");
    const qty = Number(row[6]);
    const total = Number(row[7]);
    const laba = total - ((modalMap[row[2]] || 0) * qty);
    
    if (!daily[d]) daily[d] = { tanggal: d, omzet: 0, laba: 0 };
    daily[d].omzet += total;
    daily[d].laba += laba;
  });
  return Object.values(daily).sort((a,b) => b.tanggal.localeCompare(a.tanggal));
}

function processFishSale(d) {
  const sheet = SS.getSheetByName(CONFIG.PENJUALAN_IKAN.name);
  const total = d.qtyKg * d.hargaJual;
  const totalCogs = d.qtyKg * d.cogsKg;
  sheet.appendRow([new Date(), d.jenisIkan, d.qtyKg, d.hargaJual, total, d.cogsKg, totalCogs, total - totalCogs]);
  return { status: 'success' };
}

function getFishProfitStats() {
  const sheet = SS.getSheetByName(CONFIG.PENJUALAN_IKAN.name);
  const data = sheet.getDataRange().getValues();
  data.shift();
  let daily = {};
  data.forEach(row => {
    const d = Utilities.formatDate(new Date(row[0]), "GMT+7", "yyyy-MM-dd");
    if (!daily[d]) daily[d] = { tanggal: d, omzet: 0, laba: 0 };
    daily[d].omzet += Number(row[4]);
    daily[d].laba += Number(row[7]);
  });
  return Object.values(daily).sort((a,b) => b.tanggal.localeCompare(a.tanggal));
}

function processDigitalSale(d) {
  const sheet = SS.getSheetByName(CONFIG.PRODUK_DIGITAL.name);
  const untung = d.hargaJual - (Number(d.nominal) || 0);
  sheet.appendRow([new Date(), d.nominal, d.hargaJual, untung, d.catatan]);
  return { status: 'success' };
}

function getDigitalProfitStats() {
  const sheet = SS.getSheetByName(CONFIG.PRODUK_DIGITAL.name);
  const data = sheet.getDataRange().getValues();
  data.shift();
  let daily = {};
  data.forEach(row => {
    const d = Utilities.formatDate(new Date(row[0]), "GMT+7", "yyyy-MM-dd");
    if (!daily[d]) daily[d] = { tanggal: d, omzet: 0, laba: 0 };
    daily[d].omzet += Number(row[2]);
    daily[d].laba += Number(row[3]);
  });
  return Object.values(daily).sort((a,b) => b.tanggal.localeCompare(a.tanggal));
}

function handleStockAction(p) {
  const sheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == p.sku) {
      let total = Number(data[i][6]) || 0;
      let sisa = Number(data[i][7]) || 0;
      if (p.action === 'restock') {
        total += Number(p.qty);
        sisa += Number(p.qty);
        if (p.modalBaru) sheet.getRange(i + 1, 4).setValue(p.modalBaru);
      } else {
        sisa = Number(p.qty);
      }
      sheet.getRange(i + 1, 7).setValue(total);
      sheet.getRange(i + 1, 8).setValue(sisa);
      SS.getSheetByName(CONFIG.LOG_STOK.name).appendRow([new Date(), p.sku, data[i][2], p.action.toUpperCase(), p.qty, p.alasan, sisa]);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'SKU tidak ditemukan' };
}

