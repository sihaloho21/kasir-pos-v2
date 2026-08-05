/**
 * GOOGLE APPS SCRIPT BACKEND FOR POS SYSTEM (AUTO-SETUP VERSION)
 * Fitur: Auto-create Sheets, Get Data Produk, Proses Transaksi, Update Stok, Update Rekap
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

// Nama Sheet dan Header Kolom Sesuai Input Pengguna
const CONFIG = {
  PRODUK: {
    name: 'PRODUK',
    headers: ['SKU', 'Kategori', 'Nama Produk', 'Harga Modal (Rp)', 'Satuan', 'Perkiraan Harga (Rp)', 'STOK', 'SISA STOK', 'MODAL BARANG', 'SUPLIER']
  },
  PENJUALAN: {
    name: 'Penjualan',
    headers: ['ID', 'TANGGAL', 'SKU', 'PRODUK', 'SATUAN', 'HARGA', 'JUMLAH', 'TOTAL', 'Harga Modal (Rp)']
  },
  REKAP: {
    name: 'Rekap Produk',
    headers: ['SKU', 'Nama Produk', 'Satuan', 'Harga Modal (Rp)', 'Harga Jual (Rp)', 'Qty Terjual', 'Omzet (Rp)', 'HPP (Rp)', 'Laba Kotor (Rp)']
  },

  PENJUALAN_IKAN: {
    name: 'Penjualan_Ikan',
    headers: ['Tanggal Terjual', 'Jenis Ikan', 'Jumlah Terjual (kg)', 'Harga Jual per Kg', 'Total Harga Jual', 'COGS per Kg (Avg Beli)', 'Total COGS', 'Total Keuntungan']
  },
  PRODUK_DIGITAL: {
    name: 'Produk_Digital',
    headers: ['TANGGAL', 'NOMINAL', 'HARGA JUAL', 'KEUNTUNGAN', 'CATATAN']
  },
  MANUAL_REKAP: {
    name: 'Manual_Rekap_Bulanan',
    headers: ['Bulan', 'Laba Warung', 'Laba Ikan', 'Laba Digital']
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
    } else {
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (currentHeaders.length < sheetConfig.headers.length) {
        sheet.getRange(1, 1, 1, sheetConfig.headers.length).setValues([sheetConfig.headers]).setFontWeight("bold").setBackground("#f3f3f3");
      }
    }
  });

  // --- Migrasi Data untuk sheet Penjualan ---
  const penjualanSheet = SS.getSheetByName(CONFIG.PENJUALAN.name);
  if (penjualanSheet) {
    const lastRow = penjualanSheet.getLastRow();
    if (lastRow > 1) {
      const penjualanData = penjualanSheet.getDataRange().getValues();
      const headers = penjualanData[0];
      
      // Pencarian kolom secara fleksibel (mencari kata kunci)
      const findColIndex = (headerArray, keyword) => {
        return headerArray.findIndex(h => h.toString().toLowerCase().includes(keyword.toLowerCase()));
      };

      const modalPriceColIndex = findColIndex(headers, 'Modal');
      const skuColIndex = findColIndex(headers, 'SKU');

      if (modalPriceColIndex !== -1 && skuColIndex !== -1) {
        const produkSheet = SS.getSheetByName(CONFIG.PRODUK.name);
        const produkData = produkSheet.getDataRange().getValues();
        const currentModalMap = {};
        for (let i = 1; i < produkData.length; i++) {
          currentModalMap[produkData[i][0]] = sanitizeNumber(produkData[i][3]); // SKU -> Harga Modal (Rp)
        }

        let updatedRows = [];
        let hasChanges = false;
        for (let i = 1; i < penjualanData.length; i++) {
          const row = penjualanData[i];
          const sku = row[skuColIndex];
          const existingModal = sanitizeNumber(row[modalPriceColIndex]);

          // Jika kolom Harga Modal kosong atau nol, isi dengan harga modal saat ini
          if (existingModal === 0) {
            const modalValue = currentModalMap[sku] || 0;
            if (modalValue > 0) {
              row[modalPriceColIndex] = modalValue;
              hasChanges = true;
            }
          }
          updatedRows.push(row);
        }
        
        if (hasChanges) {
          penjualanSheet.getRange(2, 1, updatedRows.length, headers.length).setValues(updatedRows);
        }
      }
    }
  }
  return "Setup Selesai!";
}

// Fungsi pembantu untuk membersihkan angka (menangani string Rp, titik, koma)
function sanitizeNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().replace(/[^\d,-]/g, '').replace(',', '.');
  let num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getProducts') return createResponse(getProductsData());
    if (action === 'getDashboardStats') return createResponse(getDashboardStats());
    if (action === 'getDailyProfitStats') return createResponse(getDailyProfitStats());
    if (action === 'getFishProfitStats') return createResponse(getFishProfitStats());
    if (action === 'getDigitalProfitStats') return createResponse(getDigitalProfitStats());
    if (action === 'getManualMonthlyStats') return createResponse(getManualMonthlyStats());
    return createResponse({ status: 'error', message: 'Action not found' });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'processFishSale') return createResponse(processFishSale(data));
    if (action === 'processDigitalSale') return createResponse(processDigitalSale(data));
    if (action === 'updateProductPrice') return createResponse(updateProductPrice(data));
    if (action === 'saveManualMonthly') return createResponse(saveManualMonthly(data));
    if (action === 'processTransaction' || data.items) return createResponse(processTransaction(data));
    
    return createResponse({ status: 'error', message: 'Action tidak dikenali: ' + action });
  } catch (err) {
    return createResponse({ status: 'error', message: 'Server Error: ' + err.toString() });
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
    const tglRaw = row[1];
    if (!tglRaw) return;
    const soldDate = Utilities.formatDate(new Date(tglRaw), "GMT+7", "yyyy-MM-dd");
    if (soldDate !== todayStr) return;

    const sku = row[2];
    todaySoldQtyMap[sku] = (todaySoldQtyMap[sku] || 0) + (sanitizeNumber(row[6]) || 0);
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

  const produkSheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const produkData = produkSheet.getDataRange().getValues();
  const modalMap = {};
  for (let i = 1; i < produkData.length; i++) {
    modalMap[produkData[i][0]] = sanitizeNumber(produkData[i][3]); // SKU -> Harga Modal (Rp)
  }

  items.forEach(item => {
    const currentModal = modalMap[item.SKU] || 0;
    sheetPenjualan.appendRow([trxId, dateStr, item.SKU, item.Nama_Produk, item.Satuan, item.Harga_Satuan, item.Qty, item.Total, currentModal]);
    updateStock(item.SKU, item.Qty);
    updateRekap(item, currentModal);
  });

  return { status: 'success', trxId: trxId };
}

function updateStock(sku, qtySold) {
  const sheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == sku) { 
      const currentSisaStok = sanitizeNumber(data[i][7]) || 0;
      sheet.getRange(i + 1, 8).setValue(currentSisaStok - qtySold);
      break;
    }
  }
}

function updateRekap(item, manualModal) {
  const sheet = SS.getSheetByName(CONFIG.REKAP.name);
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == item.SKU) {
      const currentQty = sanitizeNumber(data[i][5]) || 0;
      const currentOmzet = sanitizeNumber(data[i][6]) || 0;
      const currentHPP = sanitizeNumber(data[i][7]) || 0;
      const modal = manualModal !== undefined ? manualModal : (sanitizeNumber(data[i][3]) || 0);
      
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
    let modal = manualModal;
    if (modal === undefined) {
      const produkData = SS.getSheetByName(CONFIG.PRODUK.name).getDataRange().getValues();
      for(let j=1; j<produkData.length; j++) {
        if(produkData[j][0] == item.SKU) {
          modal = sanitizeNumber(produkData[j][3]);
          break;
        }
      }
    }
    const hpp = (modal || 0) * item.Qty;
    sheet.appendRow([item.SKU, item.Nama_Produk, item.Satuan, modal || 0, item.Harga_Satuan, item.Qty, item.Total, hpp, item.Total - hpp]);
  }
}

function getDashboardStats() {
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
  
  const sheetPenjualan = SS.getSheetByName(CONFIG.PENJUALAN.name);
  const data = sheetPenjualan.getDataRange().getValues();
  const headers = data.shift();
  
  const findColIndex = (headerArray, keyword) => {
    return headerArray.findIndex(h => h.toString().toLowerCase().includes(keyword.toLowerCase()));
  };

  const skuCol = findColIndex(headers, 'SKU');
  const namaCol = findColIndex(headers, 'PRODUK');
  const qtyCol = findColIndex(headers, 'JUMLAH');
  const totalCol = findColIndex(headers, 'TOTAL');
  const modalCol = findColIndex(headers, 'Modal');

  let stats = { daily: { omzet: 0, laba: 0, items: {} } };

  data.forEach(row => {
    const tglRaw = row[1];
    if (!tglRaw) return;
    const tgl = new Date(tglRaw);
    if (Utilities.formatDate(tgl, "GMT+7", "yyyy-MM-dd") === todayStr) {
      const nama = row[namaCol] || 'Unknown';
      const qty = sanitizeNumber(row[qtyCol]) || 0;
      const total = sanitizeNumber(row[totalCol]) || 0;
      const modal = sanitizeNumber(row[modalCol]) || 0;
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
  const headers = data.shift();
  
  const findColIndex = (headerArray, keyword) => {
    return headerArray.findIndex(h => h.toString().toLowerCase().includes(keyword.toLowerCase()));
  };

  const qtyCol = findColIndex(headers, 'JUMLAH');
  const totalCol = findColIndex(headers, 'TOTAL');
  const modalCol = findColIndex(headers, 'Modal');

  let daily = {};
  data.forEach(row => {
    const tglRaw = row[1];
    if (!tglRaw) return;
    const d = Utilities.formatDate(new Date(tglRaw), "GMT+7", "yyyy-MM-dd");
    const qty = sanitizeNumber(row[qtyCol]) || 0;
    const total = sanitizeNumber(row[totalCol]) || 0;
    const modal = sanitizeNumber(row[modalCol]) || 0;
    const laba = total - (modal * qty);
    
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
    const tglRaw = row[0];
    if (!tglRaw) return;
    const d = Utilities.formatDate(new Date(tglRaw), "GMT+7", "yyyy-MM-dd");
    if (!daily[d]) daily[d] = { tanggal: d, omzet: 0, laba: 0 };
    daily[d].omzet += sanitizeNumber(row[4]) || 0;
    daily[d].laba += sanitizeNumber(row[7]) || 0;
  });
  return Object.values(daily).sort((a,b) => b.tanggal.localeCompare(a.tanggal));
}

function processDigitalSale(d) {
  const sheet = SS.getSheetByName(CONFIG.PRODUK_DIGITAL.name);
  const untung = d.hargaJual - (sanitizeNumber(d.nominal) || 0);
  sheet.appendRow([new Date(), d.nominal, d.hargaJual, untung, d.catatan]);
  return { status: 'success' };
}

function getDigitalProfitStats() {
  const sheet = SS.getSheetByName(CONFIG.PRODUK_DIGITAL.name);
  const data = sheet.getDataRange().getValues();
  data.shift();
  let daily = {};
  data.forEach(row => {
    const tglRaw = row[0];
    if (!tglRaw) return;
    const d = Utilities.formatDate(new Date(tglRaw), "GMT+7", "yyyy-MM-dd");
    if (!daily[d]) daily[d] = { tanggal: d, omzet: 0, laba: 0 };
    daily[d].omzet += sanitizeNumber(row[2]) || 0;
    daily[d].laba += sanitizeNumber(row[3]) || 0;
  });
  return Object.values(daily).sort((a,b) => b.tanggal.localeCompare(a.tanggal));
}

function updateProductPrice(data) {
  const { sku, hargaModal, hargaJual } = data;
  const sheet = SS.getSheetByName(CONFIG.PRODUK.name);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == sku) {
      sheet.getRange(i + 1, 4).setValue(hargaModal);
      sheet.getRange(i + 1, 6).setValue(hargaJual);
      
      const sheetRekap = SS.getSheetByName(CONFIG.REKAP.name);
      const rekapRows = sheetRekap.getDataRange().getValues();
      for (let j = 1; j < rekapRows.length; j++) {
        if (rekapRows[j][0] == sku) {
          sheetRekap.getRange(j + 1, 4).setValue(hargaModal);
          sheetRekap.getRange(j + 1, 5).setValue(hargaJual);
          break;
        }
      }
      
      return { status: 'success', message: 'Harga berhasil diperbarui' };
    }
  }
  return { status: 'error', message: 'Produk tidak ditemukan' };
}

function saveManualMonthly(d) {
  const sheet = SS.getSheetByName(CONFIG.MANUAL_REKAP.name);
  if (!sheet) setupSheets();
  const targetSheet = SS.getSheetByName(CONFIG.MANUAL_REKAP.name);
  
  const data = targetSheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    // Pastikan perbandingan bulan menggunakan string untuk menghindari masalah format Date
    let rowBulan = data[i][0];
    if (rowBulan instanceof Date) {
      rowBulan = Utilities.formatDate(rowBulan, "GMT+7", "yyyy-MM");
    }
    if (String(rowBulan) === String(d.bulan)) {
      foundRow = i + 1;
      break;
    }
  }
  
  const rowData = [d.bulan, d.warung, d.fish, d.digital];
  if (foundRow !== -1) {
    targetSheet.getRange(foundRow, 1, 1, 4).setValues([rowData]);
  } else {
    targetSheet.appendRow(rowData);
  }
  return { status: 'success' };
}

function getManualMonthlyStats() {
  const sheet = SS.getSheetByName(CONFIG.MANUAL_REKAP.name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => ({
    bulan: row[0],
    warung: sanitizeNumber(row[1]),
    fish: sanitizeNumber(row[2]),
    digital: sanitizeNumber(row[3])
  }));
}
