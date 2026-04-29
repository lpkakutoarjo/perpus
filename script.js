// GANTI DENGAN URL DEPLOYMENT GOOGLE APPS SCRIPT ANDA YANG BARU
const scriptUrl = "https://script.google.com/macros/s/AKfycbwxyO3xcY9vJkqb4JlZuVTjWmjV6cv4fCWCiZxyOPL51_6u-gx2YLlAbvyJyZHVQQrp/exec";

// Variabel Global Data
let dataKategori = [];
let dataBuku = [];
let dataAnggota = [];
let dataPinjam = [];

// Menampilkan Tanggal Hari Ini
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById('date-display').innerText = new Date().toLocaleDateString('id-ID', options);

// ==========================================
// UI NAVIGASI & SIDEBAR
// ==========================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function switchMenu(menuId, element) {
    document.querySelectorAll('.menu-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    document.getElementById('menu-' + menuId).classList.add('active');
    if (element) element.classList.add('active');

    const titles = {
        'dashboard': 'Dashboard Utama',
        'peminjaman': 'Manajemen Data Peminjaman',
        'kategori': 'Manajemen Data Kategori',
        'buku': 'Manajemen Data Buku',
        'anggota': 'Manajemen Data Anggota'
    };
    document.getElementById('page-title').innerText = titles[menuId] || 'Dashboard';

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }
}

// ==========================================
// AMBIL DATA DARI BACKEND (GAS)
// ==========================================
async function fetchData() {
    const statusEl = document.getElementById('status-koneksi');
    statusEl.className = 'status';
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghubungkan...';

    try {
        const response = await fetch(`${scriptUrl}?action=getDashboardData`);
        const result = await response.json();

        if (result.status === 'success') {
            dataKategori = result.kategori;
            dataBuku = result.buku;
            dataAnggota = result.anggota;
            dataPinjam = result.peminjaman;

            // --- PERBAIKAN LOGIKA PERHITUNGAN DASHBOARD ---
            document.getElementById('stat-kategori').innerText = dataKategori.length;
            document.getElementById('stat-buku').innerText = dataBuku.length; 
            
            // Hitung manual peminjaman yang belum kembali
            let bukuBelumKembali = dataPinjam.filter(row => {
                let statusVal = row[7] ? String(row[7]).trim().toLowerCase() : '';
                return statusVal.includes('belum');
            }).length;
            document.getElementById('stat-kembali').innerText = bukuBelumKembali;
            
            document.getElementById('stat-anggota').innerText = dataAnggota.length + " Orang";

            // Render Semua Tabel
            renderTableDashboard();
            renderTablePeminjaman();
            renderTableKategori();
            renderTableBuku();
            renderTableAnggota();

            statusEl.className = 'status connected';
            statusEl.innerHTML = '<i class="fa-solid fa-wifi"></i> Terhubung';
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        statusEl.className = 'status disconnected';
        statusEl.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> Terputus';
    }
}

// LOGIKA SINKRONISASI BUKU & KATEGORI
function hitungBukuPerKategori(kodeKategori) {
    // Pastikan target kode bersih dari spasi dan berhuruf besar (Misal: "I")
    const targetKode = String(kodeKategori).trim().toUpperCase();
    
    return dataBuku.filter(buku => {
        if (!buku[1]) return false; // Abaikan jika kosong
        
        // Membaca kategori di sheet Buku (Misal: "I-KESUSASTRAAN" atau "I - KESUSASTRAAN")
        const teksKategoriBuku = String(buku[1]).toUpperCase();
        
        // Pisahkan teks berdasarkan tanda "-" lalu ambil bagian sebelah kiri (Index 0)
        // Kemudian hilangkan spasi sisa dengan .trim()
        const kodeDiBuku = teksKategoriBuku.split('-')[0].trim();
        
        // Cocokkan secara eksak: Hanya "I" yang sama dengan "I", 
        // "II" atau huruf "I" di tengah kata tidak akan ikut terhitung.
        return kodeDiBuku === targetKode;
        
    }).length; 
}

// ==========================================
// FUNGSI PENGIRIMAN DATA (API POST) DENGAN LOADING
// ==========================================
async function submitDataProses(payload, successMessage) {
    Swal.fire({
        title: 'Memproses Data...',
        html: 'Mohon tunggu, sistem sedang memperbarui database.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await fetch(scriptUrl, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();

        if (result.status === 'success') {
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: successMessage, timer: 1500, showConfirmButton: false });
            fetchData(); // Refresh Data Otomatis setelah update
        } else {
            Swal.fire({ icon: 'error', title: 'Gagal', text: result.message });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error Jaringan', text: 'Koneksi terputus saat menghubungi server.' });
    }
}

function konfirmasiHapus(action, idKey, idValue, namaItem) {
    Swal.fire({
        title: 'Hapus Data?',
        html: `Anda yakin ingin menghapus <b>${namaItem}</b>?<br>Tindakan ini tidak dapat dibatalkan.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa-solid fa-trash"></i> Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            let payload = { action: action };
            payload[idKey] = idValue;
            submitDataProses(payload, 'Data berhasil dihapus dari sistem.');
        }
    });
}

// Deteksi tombol Enter untuk otomatis Submit di SweetAlert
const enterToSubmit = () => {
    const inputs = Swal.getPopup().querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { Swal.clickConfirm(); }
        });
    });
};

// Mencegah error kutip tunggal/ganda di HTML attributes
const safeTxt = (str) => String(str || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");


// ==========================================
// FUNGSI RENDER TABEL & SORTING
// ==========================================

// 1. Menyimpan State Pengurutan (Kolom apa yang diurutkan dan jenisnya ASC/DESC)
let sortState = {
    dash: { col: -1, order: 'desc' },
    pinjam: { col: -1, order: 'desc' },
    buku: { col: -1, order: 'desc' },
    anggota: { col: -1, order: 'desc' },
    kategori: { col: -1, order: 'asc' } // Kategori defaultnya Atas ke Bawah
};

// 2. Fungsi Eksekusi Sorting saat Header Tabel diklik
function setSort(tabel, colIndex) {
    if (sortState[tabel].col === colIndex) {
        sortState[tabel].order = sortState[tabel].order === 'asc' ? 'desc' : 'asc';
    } else {
        sortState[tabel].col = colIndex;
        sortState[tabel].order = 'asc';
    }
    
    if (tabel === 'dash') renderTableDashboard();
    if (tabel === 'pinjam') renderTablePeminjaman();
    if (tabel === 'buku') renderTableBuku();
    if (tabel === 'anggota') renderTableAnggota();
    if (tabel === 'kategori') renderTableKategori();
}

// 3. Fungsi Menampilkan Icon Panah (Naik / Turun)
function getSortIcon(tabel, colIndex) {
    if (sortState[tabel].col !== colIndex) {
        return '<i class="fa-solid fa-sort" style="color:#cbd5e1; margin-left:5px;"></i>';
    }
    return sortState[tabel].order === 'asc' 
        ? '<i class="fa-solid fa-sort-up" style="color:#3b82f6; margin-left:5px;"></i>' 
        : '<i class="fa-solid fa-sort-down" style="color:#3b82f6; margin-left:5px;"></i>';
}

function renderTableDashboard() {
    const tbody = document.getElementById('tbody-dash-pinjam');
    const thead = document.querySelector('#table-dash-pinjam thead');
    if(!tbody) return;

    // Suntik Thead Baru agar Header bisa diklik
    if (thead) {
        thead.innerHTML = `<tr>
            <th width="50px">No</th>
            <th onclick="setSort('dash', 0)" style="cursor:pointer; user-select:none; white-space:nowrap;">No Anggota ${getSortIcon('dash', 0)}</th>
            <th onclick="setSort('dash', 1)" style="cursor:pointer; user-select:none; white-space:nowrap;">Nama Lengkap ${getSortIcon('dash', 1)}</th>
            <th>Kode Buku</th>
            <th>Judul Buku</th>
            <th>Jml</th>
            <th>Tgl Pinjam</th>
            <th>Tgl Kembali</th>
            <th>Status</th>
        </tr>`;
    }

    const limit = document.getElementById('limit-dash-pinjam').value;
    const search = document.getElementById('search-dash-pinjam').value.toLowerCase();
    
    let dataArr = [...dataPinjam];
    
    // Logika Pengurutan
    if (sortState.dash.col !== -1) {
        let c = sortState.dash.col;
        let isAsc = sortState.dash.order === 'asc';
        dataArr.sort((a, b) => {
            let valA = String(a[c] || '').toLowerCase();
            let valB = String(b[c] || '').toLowerCase();
            return isAsc ? valA.localeCompare(valB, undefined, {numeric: true}) : valB.localeCompare(valA, undefined, {numeric: true});
        });
    } else {
        dataArr.reverse(); // Default sheet terbaru di atas
    }

    let filtered = dataArr.filter(row => {
        let statusVal = row[7] ? String(row[7]).trim().toLowerCase() : '';
        return statusVal.includes('belum') &&
        ((row[0]||'').toString().toLowerCase().includes(search) || (row[1]||'').toString().toLowerCase().includes(search) || (row[2]||'').toString().toLowerCase().includes(search));
    });
    
    let displayData = limit === 'all' ? filtered : filtered.slice(0, parseInt(limit));
    
    let rowsHtml = '';
    if (displayData.length === 0) {
        rowsHtml = `<tr><td colspan="9" class="text-center text-muted">Buku sudah kembali semua / Data tidak ditemukan</td></tr>`;
    } else {
        displayData.forEach((row, index) => {
            rowsHtml += `<tr>
                <td class="text-center">${index + 1}</td>
                <td>${row[0]}</td>
                <td><strong>${row[1]}</strong></td>
                <td>${row[2]}</td>
                <td>${row[3]}</td>
                <td class="text-center">${row[4]}</td>
                <td>${row[5]}</td>
                <td>${row[6]}</td>
                <td class="text-center"><span class="history-badge badge-out">Belum Kembali</span></td>
            </tr>`;
        });
    }
    tbody.innerHTML = rowsHtml;
    document.getElementById('info-dash-pinjam').innerText = `Menampilkan ${displayData.length} dari ${filtered.length} peminjaman aktif.`;
}

function renderTablePeminjaman() {
    const tbody = document.getElementById('tbody-peminjaman');
    const thead = document.querySelector('#table-peminjaman thead');
    if(!tbody) return;

    if(thead) {
        thead.innerHTML = `<tr>
            <th width="50px">No</th>
            <th onclick="setSort('pinjam', 0)" style="cursor:pointer; user-select:none; white-space:nowrap;">No Anggota ${getSortIcon('pinjam', 0)}</th>
            <th onclick="setSort('pinjam', 1)" style="cursor:pointer; user-select:none; white-space:nowrap;">Nama Lengkap ${getSortIcon('pinjam', 1)}</th>
            <th>Kode Buku</th>
            <th>Judul Buku</th>
            <th>Jml</th>
            <th>Tgl Pinjam</th>
            <th>Tgl Kembali</th>
            <th>Tgl Pengembalian</th>
            <th>Denda</th>
            <th class="text-center">Aksi</th>
        </tr>`;
    }

    const limit = document.getElementById('limit-peminjaman').value;
    const search = document.getElementById('search-peminjaman').value.toLowerCase();
    
    let dataArr = [...dataPinjam];
    if (sortState.pinjam.col !== -1) {
        let c = sortState.pinjam.col;
        let isAsc = sortState.pinjam.order === 'asc';
        dataArr.sort((a, b) => {
            let valA = String(a[c] || '').toLowerCase();
            let valB = String(b[c] || '').toLowerCase();
            return isAsc ? valA.localeCompare(valB, undefined, {numeric: true}) : valB.localeCompare(valA, undefined, {numeric: true});
        });
    } else {
        dataArr.reverse();
    }

    let filtered = dataArr.filter(row => 
        (row[0]||'').toString().toLowerCase().includes(search) || 
        (row[1]||'').toString().toLowerCase().includes(search) || 
        (row[2]||'').toString().toLowerCase().includes(search) ||
        (row[3]||'').toString().toLowerCase().includes(search)
    );

    let displayData = limit === 'all' ? filtered : filtered.slice(0, parseInt(limit));
    
    let rowsHtml = '';
    if (displayData.length === 0) {
        rowsHtml = `<tr><td colspan="11" class="text-center text-muted">Data Peminjaman tidak ditemukan</td></tr>`;
    } else {
        displayData.forEach((row, index) => {
            const noAng = safeTxt(row[0]), nama = safeTxt(row[1]), kodeBuku = safeTxt(row[2]), judul = safeTxt(row[3]);
            const jml = row[4], tPinjam = row[5], tKembali = row[6], denda = row[8] ? row[8] : 'Rp. 0';
            const statusVal = row[7] ? String(row[7]).trim() : 'Belum Dikembalikan';
            const flagPerpanjang = row[9]; 

            const isReturned = !statusVal.toLowerCase().includes('belum');
            const statusText = isReturned ? `<span class="history-badge badge-in">${statusVal}</span>` : '<span class="history-badge badge-out">Belum Dikembalikan</span>';
            const btnPerpanjang = flagPerpanjang == 1 ? '' : `<button class="btn-more-sm" style="background:#fef08a; color:#854d0e; border:none;" onclick="perpanjangBuku('${noAng}', '${kodeBuku}', '${tKembali}')"><i class="fa-solid fa-clock"></i> Perpanjang</button>`;
            
            let actionBtn = isReturned ? 
                `<span class="history-badge badge-in"><i class="fa-solid fa-check"></i> Selesai</span>` : 
                `<button class="btn-more-sm" style="background:#dcfce7; color:#166534; border:none;" onclick="kembalikanBuku('${noAng}', '${kodeBuku}', '${jml}')"><i class="fa-solid fa-rotate-left"></i> Kembalikan</button> ${btnPerpanjang}`;

            rowsHtml += `<tr>
                <td class="text-center">${index + 1}</td>
                <td>${noAng}</td>
                <td><strong>${nama}</strong></td>
                <td>${kodeBuku}</td>
                <td>${judul}</td>
                <td class="text-center">${jml}</td>
                <td>${tPinjam}</td>
                <td>${tKembali}</td>
                <td class="text-center">${statusText}</td>
                <td class="text-center">${denda}</td>
                <td class="text-center">${actionBtn}</td>
            </tr>`;
        });
    }
    tbody.innerHTML = rowsHtml;
    document.getElementById('info-peminjaman').innerText = `Menampilkan ${displayData.length} dari total ${filtered.length} data peminjaman.`;
}

function renderTableKategori() {
    const tbody = document.getElementById('tbody-kategori');
    if(!tbody) return;
    const thead = tbody.parentNode.querySelector('thead');

    if(thead) {
        thead.innerHTML = `<tr>
            <th width="50px">No</th>
            <th onclick="setSort('kategori', 0)" style="cursor:pointer; user-select:none; white-space:nowrap;">Kode Kategori ${getSortIcon('kategori', 0)}</th>
            <th>Nama Kategori</th>
            <th>Total Buku (Stok)</th>
            <th width="15%" class="text-center">Aksi</th>
        </tr>`;
    }

    const limit = document.getElementById('limit-kategori').value;
    const search = document.getElementById('search-kategori').value.toLowerCase();
    
    let dataArr = [...dataKategori];

    if (sortState.kategori.col !== -1) {
        let c = sortState.kategori.col;
        let isAsc = sortState.kategori.order === 'asc';
        dataArr.sort((a, b) => {
            let valA = String(a[c] || '').toLowerCase();
            let valB = String(b[c] || '').toLowerCase();
            return isAsc ? valA.localeCompare(valB, undefined, {numeric: true}) : valB.localeCompare(valA, undefined, {numeric: true});
        });
    } 
    // Jika tidak disort manual, default membiarkan Array utuh agar sesuai dengan Urutan Sheet Database Atas ke Bawah

    let filtered = dataArr.filter(row => row[1].toLowerCase().includes(search) || row[0].toLowerCase().includes(search));
    let displayData = limit === 'all' ? filtered : filtered.slice(0, parseInt(limit));

    let rowsHtml = '';
    if (displayData.length === 0) {
        rowsHtml = `<tr><td colspan="5" class="text-center text-muted">Data kategori tidak ditemukan</td></tr>`;
    } else {
        displayData.forEach((row, index) => {
            const jumlahBukuAktif = hitungBukuPerKategori(row[0]);
            const sKode = safeTxt(row[0]);
            const sNama = safeTxt(row[1]);

            rowsHtml += `<tr>
                <td class="text-center">${index + 1}</td>
                <td><strong>${row[0]}</strong></td>
                <td>${row[1]}</td>
                <td class="text-center"><span class="badge-count">${jumlahBukuAktif}</span></td>
                <td class="text-center">
                    <button class="btn-more-sm" onclick="modalFormKategori('edit', '${sKode}', '${sNama}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-del" onclick="konfirmasiHapus('hapusKategori', 'kode', '${sKode}', '${sNama}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = rowsHtml;
    document.getElementById('info-kategori').innerText = `Menampilkan ${displayData.length} dari total ${filtered.length} kategori.`;
}

function renderTableBuku() {
    const tbody = document.getElementById('tbody-buku');
    const thead = document.querySelector('#table-buku thead');
    if(!tbody) return;

    if(thead) {
        thead.innerHTML = `<tr>
            <th width="50px">No</th>
            <th onclick="setSort('buku', 1)" style="cursor:pointer; user-select:none; white-space:nowrap;">Kategori ${getSortIcon('buku', 1)}</th>
            <th onclick="setSort('buku', 2)" style="cursor:pointer; user-select:none; white-space:nowrap;">Kode Buku ${getSortIcon('buku', 2)}</th>
            <th onclick="setSort('buku', 3)" style="cursor:pointer; user-select:none; white-space:nowrap;">Judul Buku ${getSortIcon('buku', 3)}</th>
            <th>Edisi / Jilid</th>
            <th>Penerbit / Kota</th>
            <th>Tahun</th>
            <th>Stok</th>
            <th>Pengarang</th>
            <th class="text-center">Aksi</th>
        </tr>`;
    }

    const limit = document.getElementById('limit-buku').value;
    const search = document.getElementById('search-buku').value.toLowerCase();
    
    let dataArr = [...dataBuku];

    if (sortState.buku.col !== -1) {
        let c = sortState.buku.col;
        let isAsc = sortState.buku.order === 'asc';
        dataArr.sort((a, b) => {
            let valA = String(a[c] || '').toLowerCase();
            let valB = String(b[c] || '').toLowerCase();
            return isAsc ? valA.localeCompare(valB, undefined, {numeric: true}) : valB.localeCompare(valA, undefined, {numeric: true});
        });
    } else {
        dataArr.reverse();
    }

    let filtered = dataArr.filter(row => 
        row[3].toLowerCase().includes(search) || row[2].toLowerCase().includes(search) || row[1].toLowerCase().includes(search)
    );
    let displayData = limit === 'all' ? filtered : filtered.slice(0, parseInt(limit));

    let rowsHtml = '';
    if (displayData.length === 0) {
        rowsHtml = `<tr><td colspan="10" class="text-center text-muted">Data buku tidak ditemukan</td></tr>`;
    } else {
        displayData.forEach((row, index) => {
            const sKat=safeTxt(row[1]), sKode=safeTxt(row[2]), sJudul=safeTxt(row[3]), sEd=safeTxt(row[4]), sJilid=safeTxt(row[5]);
            const sPen=safeTxt(row[6]), sKota=safeTxt(row[7]), sThn=safeTxt(row[8]), sIsbn=safeTxt(row[9]), sStok=safeTxt(row[10]);
            const sP1=safeTxt(row[11]), sP2=safeTxt(row[12]);

            rowsHtml += `<tr>
                <td class="text-center">${index + 1}</td>
                <td>${row[1]}</td>
                <td><strong>${row[2]}</strong></td>
                <td>${row[3]}</td>
                <td>Edisi: ${row[4] || '-'} <br> Jilid: ${row[5] || '-'}</td>
                <td>${row[6]} <br> <span class="text-muted">${row[7]}</span></td>
                <td class="text-center">${row[8]}</td>
                <td class="text-center"><span class="badge-count">${row[10]}</span></td>
                <td>${row[11]} <br> ${row[12] ? '<span class="text-muted">'+row[12]+'</span>' : ''}</td>
                <td class="text-center">
                    <button class="btn-more-sm" onclick="modalFormBuku('edit', '${sKat}', '${sKode}', '${sJudul}', '${sEd}', '${sJilid}', '${sPen}', '${sKota}', '${sThn}', '${sIsbn}', '${sStok}', '${sP1}', '${sP2}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-del" onclick="konfirmasiHapus('hapusBuku', 'kode', '${sKode}', '${sJudul}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = rowsHtml;
    document.getElementById('info-buku').innerText = `Menampilkan ${displayData.length} dari total ${filtered.length} buku.`;
}

function renderTableAnggota() {
    const tbody = document.getElementById('tbody-anggota');
    const thead = document.querySelector('#table-anggota thead');
    if(!tbody) return;

    if(thead) {
        thead.innerHTML = `<tr>
            <th width="50px">No</th>
            <th onclick="setSort('anggota', 1)" style="cursor:pointer; user-select:none; white-space:nowrap;">Kode Anggota ${getSortIcon('anggota', 1)}</th>
            <th onclick="setSort('anggota', 2)" style="cursor:pointer; user-select:none; white-space:nowrap;">Nama Lengkap ${getSortIcon('anggota', 2)}</th>
            <th>L/P</th>
            <th>Tempat, Tgl Lahir</th>
            <th>Alamat</th>
            <th onclick="setSort('anggota', 0)" style="cursor:pointer; user-select:none; white-space:nowrap;">Jml Pinjam ${getSortIcon('anggota', 0)}</th>
            <th class="text-center">Aksi</th>
        </tr>`;
    }

    const limit = document.getElementById('limit-anggota').value;
    const search = document.getElementById('search-anggota').value.toLowerCase();
    
    let dataArr = [...dataAnggota];

    if (sortState.anggota.col !== -1) {
        let c = sortState.anggota.col;
        let isAsc = sortState.anggota.order === 'asc';
        
        dataArr.sort((a, b) => {
            let valA = a[c] || '';
            let valB = b[c] || '';
            
            // Perlakuan Khusus Sorting Angka untuk Jumlah Peminjaman
            if (c === 0) {
                return isAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
            }
            // Perlakuan sorting teks alfabet (Bisa toleransi angka seperti A01 < A10)
            return isAsc 
                ? String(valA).localeCompare(String(valB), undefined, {numeric: true}) 
                : String(valB).localeCompare(String(valA), undefined, {numeric: true});
        });
    } else {
        dataArr.reverse();
    }

    let filtered = dataArr.filter(row => row[1].toLowerCase().includes(search) || row[2].toLowerCase().includes(search));
    let displayData = limit === 'all' ? filtered : filtered.slice(0, parseInt(limit));

    let rowsHtml = '';
    if (displayData.length === 0) {
        rowsHtml = `<tr><td colspan="8" class="text-center text-muted">Data anggota tidak ditemukan</td></tr>`;
    } else {
        displayData.forEach((row, index) => {
            const sJmlPinjam = row[0] ? row[0] : 0; 
            const sKode=safeTxt(row[1]), sNama=safeTxt(row[2]), sJk=safeTxt(row[3]);
            const sTtl=safeTxt(row[4]), sAlm=safeTxt(row[5]), sTelp=safeTxt(row[6]);

            rowsHtml += `<tr>
                <td class="text-center">${index + 1}</td>
                <td><strong>${row[1]}</strong></td>
                <td>${row[2]}</td>
                <td class="text-center">${row[3]}</td>
                <td>${row[4]}</td>
                <td>${row[5]}</td>
                <td class="text-center"><span class="badge-count">${sJmlPinjam}</span></td>
                <td class="text-center">
                    <button class="btn-more-sm" onclick="modalFormAnggota('edit', '${sKode}', '${sNama}', '${sJk}', '${sTtl}', '${sAlm}', '${sTelp}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-del" onclick="konfirmasiHapus('hapusAnggota', 'kode', '${sKode}', '${sNama}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = rowsHtml;
    document.getElementById('info-anggota').innerText = `Menampilkan ${displayData.length} dari total ${filtered.length} anggota.`;
}


// ==========================================
// FUNGSI POPUP FORM (TAMBAH & EDIT)
// ==========================================

// Wrapper Modals
function modalKategori() { modalFormKategori('tambah'); }
function modalBuku() { modalFormBuku('tambah'); }
function modalAnggota() { modalFormAnggota('tambah'); }

// ---------------------------------
// MODAL PEMINJAMAN BARU (UPDATED DYNAMIC DATE)
// ---------------------------------
function modalFormPinjam() {
    // Generate Opsi Datalist Anggota
    let optAnggota = dataAnggota.map(a => `<option value="${a[1]} | ${a[2]}">`).join('');
    
    // Generate Opsi Datalist Buku (Hanya yang stoknya > 0)
    let optBuku = dataBuku.filter(b => b[10] > 0).map(b => `<option value="${b[2]} | ${b[3]}">`).join('');

    if(!optBuku) {
        Swal.fire({ icon: 'warning', title: 'Oops', text: 'Tidak ada buku yang stoknya tersedia saat ini!' }); 
        return;
    }
    if(!optAnggota) {
        Swal.fire({ icon: 'warning', title: 'Oops', text: 'Belum ada data anggota yang terdaftar!' }); 
        return;
    }

    // Fungsi bantuan agar format tanggal YYYY-MM-DD aman dari perbedaan Timezone lokal
    const formatTgl = (d) => {
        let month = '' + (d.getMonth() + 1), day = '' + d.getDate(), year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    };

    // Tgl Default saat modal dibuka
    let tglHariIniObj = new Date();
    let strHariIni = formatTgl(tglHariIniObj);
    
    let tglKembaliDefaultObj = new Date();
    tglKembaliDefaultObj.setDate(tglKembaliDefaultObj.getDate() + 7);
    let strKembaliDefault = formatTgl(tglKembaliDefaultObj);

    Swal.fire({
        title: `<h3 style="margin:0;"><i class="fa-solid fa-hand-holding-hand"></i> Tambah Data Peminjaman</h3>`,
        html: `
            <div style="text-align: left; padding-top: 15px;">
                <label>Anggota Peminjam</label>
                <input list="list-anggota" id="swal-pinjam-anggota" class="input-standard" placeholder="Ketik/Pilih No. Anggota atau Nama..." autocomplete="off" required>
                <datalist id="list-anggota">${optAnggota}</datalist>
                
                <label class="mt-3">Buku yang Dipinjam</label>
                <input list="list-buku" id="swal-pinjam-buku" class="input-standard" placeholder="Ketik/Pilih Kode atau Judul Buku..." autocomplete="off" required>
                <datalist id="list-buku">${optBuku}</datalist>
                
                <label class="mt-3">Jumlah Buku</label>
                <input type="number" id="swal-pinjam-jml" class="input-standard" value="1" min="1" required>
                
                <div style="display:flex; gap:10px;" class="mt-3">
                    <div style="flex:1">
                        <label>Tgl Pinjam</label>
                        <input type="date" id="swal-pinjam-tgl" class="input-standard" value="${strHariIni}">
                    </div>
                    <div style="flex:1">
                        <label>Tgl Kembali</label>
                        <input type="date" id="swal-pinjam-tglk" class="input-standard" value="${strKembaliDefault}">
                    </div>
                </div>
            </div>
        `,
        width: '550px', showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save"></i> Simpan Peminjaman', confirmButtonColor: '#3b82f6',
        customClass: { popup: 'form-glass' },
        didOpen: () => {
            enterToSubmit(); // Tetap jalankan fungsi submit via Enter bawaan Anda
            
            // --- LOGIKA PERUBAHAN TANGGAL KEMBALI OTOMATIS ---
            const tglPinjamInput = document.getElementById('swal-pinjam-tgl');
            const tglKembaliInput = document.getElementById('swal-pinjam-tglk');

            tglPinjamInput.addEventListener('change', (e) => {
                if(e.target.value) {
                    // Membaca tanggal yang baru dipilih user
                    let selectedDate = new Date(e.target.value);
                    // Tambah 7 Hari dari tanggal yang baru
                    selectedDate.setDate(selectedDate.getDate() + 7);
                    // Format dan update ke field Tgl Kembali
                    tglKembaliInput.value = formatTgl(selectedDate);
                }
            });
        },
        preConfirm: () => {
            const valAnggota = document.getElementById('swal-pinjam-anggota').value;
            const valBuku = document.getElementById('swal-pinjam-buku').value;
            const jumlahBuku = document.getElementById('swal-pinjam-jml').value;

            if(!valAnggota || !valBuku) {
                Swal.showValidationMessage('Anggota dan Buku wajib diisi!'); return false;
            }

            const anggotaSplit = valAnggota.split(' | ');
            const bukuSplit = valBuku.split(' | ');

            if(anggotaSplit.length < 2 || bukuSplit.length < 2) {
                Swal.showValidationMessage('Harap pilih data dari daftar dropdown yang muncul!'); 
                return false;
            }

            if(!jumlahBuku || jumlahBuku < 1) {
                Swal.showValidationMessage('Jumlah buku tidak valid!'); return false;
            }
            
            submitDataProses({
                action: 'tambahPinjam',
                noAnggota: anggotaSplit[0].trim(), 
                namaLengkap: anggotaSplit[1].trim(),
                kodeBuku: bukuSplit[0].trim(), 
                judulBuku: bukuSplit[1].trim(),
                jumlah: jumlahBuku,
                tglPinjam: document.getElementById('swal-pinjam-tgl').value,
                tglKembali: document.getElementById('swal-pinjam-tglk').value
            }, 'Data Peminjaman berhasil dicatat & Stok Buku diperbarui.');
        }
    });
}

// ---------------------------------
// PENGEMBALIAN BUKU
// ---------------------------------
function kembalikanBuku(noAnggota, kodeBuku, jumlahBuku) {
    let tglHariIni = new Date().toISOString().split('T')[0];

    Swal.fire({
        title: 'Pengembalian Buku',
        html: `
            <div style="text-align:left;">
                <label>Tanggal Pengembalian</label>
                <input type="date" id="swal-kembali-tgl" class="input-standard" value="${tglHariIni}">
                <label class="mt-3">Denda (Jika Ada)</label>
                <input type="number" id="swal-kembali-denda" class="input-standard" value="0" placeholder="Nominal Rp.">
            </div>
        `,
        icon: 'info', showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-check"></i> Konfirmasi Kembali', confirmButtonColor: '#10b981',
        customClass: { popup: 'form-glass' },
        preConfirm: () => {
            let numDenda = document.getElementById('swal-kembali-denda').value;
            submitDataProses({
                action: 'kembalikanPinjam',
                noAnggota: noAnggota, 
                kodeBuku: kodeBuku, 
                jumlah: jumlahBuku,
                tglPengembalian: document.getElementById('swal-kembali-tgl').value,
                denda: numDenda > 0 ? "Rp. " + numDenda : "Rp. 0"
            }, 'Buku telah dikembalikan dan stok berhasil dipulihkan.');
        }
    });
}

// ---------------------------------
// PERPANJANG BUKU
// ---------------------------------
function perpanjangBuku(noAnggota, kodeBuku, tglJatuhTempoLama) {
    let dateObj = new Date(tglJatuhTempoLama);
    if(isNaN(dateObj)) { dateObj = new Date(); }
    dateObj.setDate(dateObj.getDate() + 7);
    
    // Format tanggal untuk frontend (Opsional agar rapi dilihat user)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let tglKembaliBaruDisplay = ('0' + dateObj.getDate()).slice(-2) + "-" + monthNames[dateObj.getMonth()] + "-" + String(dateObj.getFullYear()).slice(-2);
    let tglKirimKeSheet = dateObj.toISOString().split('T')[0]; // Format standar database

    Swal.fire({
        title: 'Perpanjang Peminjaman?',
        html: `Masa peminjaman akan ditambah 7 hari. <br>Tgl Kembali Baru: <b>${tglKembaliBaruDisplay}</b>`,
        icon: 'question', 
        showCancelButton: true, 
        confirmButtonText: '<i class="fa-solid fa-clock"></i> Ya, Perpanjang', 
        confirmButtonColor: '#eab308'
    }).then((result) => {
        if(result.isConfirmed) {
            submitDataProses({ 
                action: 'perpanjangPinjam', 
                noAnggota: noAnggota, 
                kodeBuku: kodeBuku, 
                tglKembaliBaru: tglKirimKeSheet 
            }, 'Masa pinjam berhasil diperpanjang selama 7 hari.');
        }
    });
}


function modalFormKategori(mode, kode = '', nama = '') {
    const isEdit = mode === 'edit';
    Swal.fire({
        title: `<h3 style="margin:0;"><i class="fa-solid fa-tags"></i> ${isEdit ? 'Edit' : 'Tambah'} Kategori</h3>`,
        html: `
            <div style="text-align: left; padding-top: 15px;">
                <label>Kode Kategori</label>
                <input id="swal-kode" class="input-standard" value="${kode}" placeholder="Contoh: K01" required>
                <label class="mt-3">Nama Kategori</label>
                <input id="swal-nama" class="input-standard" value="${nama}" placeholder="Contoh: Fiksi" required>
            </div>
        `,
        showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save"></i> Simpan', confirmButtonColor: '#3b82f6',
        customClass: { popup: 'form-glass' },
        didOpen: enterToSubmit,
        preConfirm: () => {
            const inputKode = document.getElementById('swal-kode').value;
            const inputNama = document.getElementById('swal-nama').value;
            if (!inputKode || !inputNama) { Swal.showValidationMessage('Semua kolom wajib diisi!'); return false; }
            
            submitDataProses({
                action: isEdit ? 'editKategori' : 'tambahKategori',
                kodeLama: kode, kodeBaru: inputKode, kode: inputKode, nama: inputNama
            }, isEdit ? 'Kategori berhasil diperbarui.' : 'Kategori berhasil ditambahkan.');
        }
    });
}

function modalFormBuku(mode, kat='', kode='', judul='', edisi='', jilid='', penerbit='', kota='', tahun='', isbn='', stok='', p1='', p2='') {
    const isEdit = mode === 'edit';
    let optKategori = dataKategori.map(k => {
        let val = `${k[0]}-${k[1]}`;
        let selected = (val === kat) ? 'selected' : '';
        return `<option value="${val}" ${selected}>${val}</option>`;
    }).join('');

    Swal.fire({
        title: `<h3 style="margin:0;"><i class="fa-solid fa-book"></i> ${isEdit ? 'Edit' : 'Tambah'} Data Buku</h3>`,
        html: `
            <div style="text-align: left; padding-top: 15px; height: 350px; overflow-y: scroll; padding-right:10px;">
                <label>Kategori</label><select id="swal-kat" class="input-standard">${optKategori}</select>
                <label class="mt-3">Kode Buku *</label><input id="swal-kode" class="input-standard" value="${kode}" required>
                <label class="mt-3">Judul Buku *</label><input id="swal-judul" class="input-standard" value="${judul}" required>
                <label class="mt-3">Edisi / Jilid</label>
                <div style="display:flex; gap:10px;">
                    <input id="swal-edisi" class="input-standard" placeholder="Edisi" value="${edisi}">
                    <input id="swal-jilid" class="input-standard" placeholder="Jilid" value="${jilid}">
                </div>
                <label class="mt-3">Penerbit / Kota</label>
                <div style="display:flex; gap:10px;">
                    <input id="swal-penerbit" class="input-standard" placeholder="Penerbit" value="${penerbit}">
                    <input id="swal-kota" class="input-standard" placeholder="Kota" value="${kota}">
                </div>
                <label class="mt-3">Tahun / ISBN / Stok *</label>
                <div style="display:flex; gap:10px;">
                    <input id="swal-tahun" class="input-standard" placeholder="Tahun" value="${tahun}">
                    <input id="swal-isbn" class="input-standard" placeholder="ISBN" value="${isbn}">
                    <input id="swal-stok" type="number" class="input-standard" placeholder="Stok" value="${stok}" required>
                </div>
                <label class="mt-3">Pengarang 1 & 2</label>
                <input id="swal-p1" class="input-standard mb-2" placeholder="Pengarang 1" value="${p1}">
                <input id="swal-p2" class="input-standard" placeholder="Pengarang 2" value="${p2}">
            </div>
        `,
        width: '600px', showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save"></i> Simpan', confirmButtonColor: '#3b82f6',
        customClass: { popup: 'form-glass' },
        didOpen: enterToSubmit,
        preConfirm: () => {
            const inputKode = document.getElementById('swal-kode').value;
            const inputJudul = document.getElementById('swal-judul').value;
            const inputStok = document.getElementById('swal-stok').value;
            if (!inputKode || !inputJudul || !inputStok) { Swal.showValidationMessage('Kode, Judul, dan Stok wajib diisi!'); return false; }
            
            submitDataProses({
                action: isEdit ? 'editBuku' : 'tambahBuku',
                kodeLama: kode, kodeBaru: inputKode, kode: inputKode,
                kategori: document.getElementById('swal-kat').value,
                judul: inputJudul,
                edisi: document.getElementById('swal-edisi').value,
                jilid: document.getElementById('swal-jilid').value,
                penerbit: document.getElementById('swal-penerbit').value,
                kota: document.getElementById('swal-kota').value,
                tahun: document.getElementById('swal-tahun').value,
                isbn: document.getElementById('swal-isbn').value,
                stok: inputStok,
                pengarang1: document.getElementById('swal-p1').value,
                pengarang2: document.getElementById('swal-p2').value
            }, isEdit ? 'Data buku diperbarui.' : 'Buku berhasil ditambahkan.');
        }
    });
}

function modalFormAnggota(mode, kode='', nama='', jk='Laki-Laki', ttl='', alamat='', telp='') {
    const isEdit = mode === 'edit';
    Swal.fire({
        title: `<h3 style="margin:0;"><i class="fa-solid fa-user-plus"></i> ${isEdit ? 'Edit' : 'Tambah'} Anggota</h3>`,
        html: `
            <div style="text-align: left; padding-top: 15px;">
                <label>Kode Anggota</label><input id="swal-kode-ang" class="input-standard" value="${kode}" required>
                <label class="mt-3">Nama Lengkap</label><input id="swal-nama-ang" class="input-standard" value="${nama}" required>
                <label class="mt-3">Jenis Kelamin</label>
                <select id="swal-jk" class="input-standard">
                    <option value="Laki-Laki" ${jk==='Laki-Laki'?'selected':''}>Laki-Laki</option>
                    <option value="Perempuan" ${jk==='Perempuan'?'selected':''}>Perempuan</option>
                </select>
                <label class="mt-3">Tempat, Tanggal Lahir</label>
                <input id="swal-ttl" class="input-standard" placeholder="Contoh: Demak, 17 Aug 2007" value="${ttl}">
                <label class="mt-3">Telephone</label><input id="swal-telp" class="input-standard" value="${telp}">
                <label class="mt-3">Alamat</label><input id="swal-alamat" class="input-standard" value="${alamat}">
            </div>
        `,
        width: '500px', showCancelButton: true, confirmButtonText: '<i class="fa-solid fa-save"></i> Simpan', confirmButtonColor: '#3b82f6',
        customClass: { popup: 'form-glass' },
        didOpen: enterToSubmit,
        preConfirm: () => {
            const inputKode = document.getElementById('swal-kode-ang').value;
            const inputNama = document.getElementById('swal-nama-ang').value;
            if (!inputKode || !inputNama) { Swal.showValidationMessage('Kode dan Nama wajib diisi!'); return false; }
            
            submitDataProses({
                action: isEdit ? 'editAnggota' : 'tambahAnggota',
                kodeLama: kode, kodeBaru: inputKode, kode: inputKode,
                nama: inputNama,
                jk: document.getElementById('swal-jk').value,
                ttl: document.getElementById('swal-ttl').value,
                telp: document.getElementById('swal-telp').value,
                alamat: document.getElementById('swal-alamat').value
            }, isEdit ? 'Data anggota diperbarui.' : 'Anggota berhasil ditambahkan.');
        }
    });
}


// ==========================================
// FUNGSI EXPORT & PRINT (VERSI FULL DATA DATABASE)
// ==========================================

// Fungsi bantuan untuk membuat tabel HTML tersembunyi berisi seluruh data
function getFullTableHTML(tableId) {
    let html = '<table border="1" style="border-collapse: collapse; width: 100%; text-align: left;">';
    let thead = '';
    let tbody = '<tbody>';
    let data = [];

    if (tableId === 'table-peminjaman') {
        thead = '<thead><tr><th>No</th><th>No Anggota</th><th>Nama Lengkap</th><th>Kode Buku</th><th>Judul Buku</th><th>Jml</th><th>Tgl Pinjam</th><th>Tgl Kembali</th><th>Status Pengembalian</th><th>Denda</th></tr></thead>';
        // Urutkan data peminjaman terbaru di atas
        data = [...dataPinjam].reverse().sort((a,b) => {
            let dA = new Date(a[5]); let dB = new Date(b[5]);
            return (!isNaN(dA) && !isNaN(dB)) ? dB - dA : 0;
        });
        data.forEach((row, i) => {
            let denda = row[8] ? row[8] : 'Rp. 0';
            let status = row[7] ? row[7] : 'Belum Dikembalikan';
            tbody += `<tr><td>${i+1}</td><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td>${row[6]}</td><td>${status}</td><td>${denda}</td></tr>`;
        });
    } 
    else if (tableId === 'table-buku') {
        thead = '<thead><tr><th>No</th><th>Kategori</th><th>Kode Buku</th><th>Judul Buku</th><th>Edisi</th><th>Jilid</th><th>Penerbit</th><th>Kota</th><th>Tahun</th><th>ISBN</th><th>Stok</th><th>Pengarang 1</th><th>Pengarang 2</th></tr></thead>';
        // Urutkan data buku terbaru di atas
        data = [...dataBuku].reverse();
        data.forEach((row, i) => {
            tbody += `<tr><td>${i+1}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]||'-'}</td><td>${row[5]||'-'}</td><td>${row[6]}</td><td>${row[7]}</td><td>${row[8]}</td><td>${row[9]}</td><td>${row[10]}</td><td>${row[11]}</td><td>${row[12]||'-'}</td></tr>`;
        });
    } 
    else if (tableId === 'table-anggota') {
        thead = '<thead><tr><th>No</th><th>Kode Anggota</th><th>Nama Lengkap</th><th>L/P</th><th>Tempat, Tgl Lahir</th><th>Alamat</th><th>Jml Pinjam</th></tr></thead>';
        data = [...dataAnggota].sort((a,b) => String(b[1]||'').localeCompare(String(a[1]||''), undefined, {numeric: true}));
        data.forEach((row, i) => {
            // Karena Jml Pinjam ada di Kolom A, kita ambil dari row[0]
            let jmlPinjam = row[0] || 0; 
            tbody += `<tr><td>${i+1}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td style="text-align:center;">${jmlPinjam}</td></tr>`;
        });
    }
    else {
        // Fallback jika id tidak dikenali, ambil dari layar saja
        return document.getElementById(tableId).outerHTML;
    }

    tbody += '</tbody>';
    html += thead + tbody + '</table>';
    return html;
}

function exportExcel(tableId, filename) {
    // Generate full HTML dari array data mentah
    let html = getFullTableHTML(tableId);
    
    let blob = new Blob([html], { type: "application/vnd.ms-excel" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename + ".xls";
    a.click();
}

function printTable(tableId, title) {
    // Generate full HTML dari array data mentah
    let tableHTML = getFullTableHTML(tableId);
    
    let win = window.open('', '', 'height=700,width=900');
    win.document.write(`
        <html><head><title>${title}</title>
        <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; }
            h2 { text-align: center; color: #333; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f4f4f4; text-transform: uppercase; }
            /* Menyembunyikan elemen kolom tombol aksi kalau ada sisa */
            .btn-more-sm, .btn-del, .table-controls, .search-box { display: none !important; }
        </style>
        </head><body>
        <h2>${title}</h2>
        ${tableHTML}
        <script>
            setTimeout(function(){ 
                window.print(); 
                window.close(); 
            }, 800); // Waktu delay diperpanjang sedikit agar tabel full data ter-render sempurna sebelum di-print
        </script>
        </body></html>
    `);
    win.document.close();
}

// ==========================================
// FUNGSI LOGOUT
// ==========================================
function logout() {
    Swal.fire({
        title: 'Keluar Sistem?',
        text: 'Anda harus memasukkan PIN dan OTP kembali untuk masuk.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa-solid fa-right-from-bracket"></i> Ya, Logout',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            // Hapus sesi autentikasi dari browser
            sessionStorage.removeItem('perpus_auth');
            
            // Reload halaman untuk memicu kembali kunci keamanan (checkAccessPin)
            window.location.reload();
        }
    });
}

// ==========================================
// SISTEM KEAMANAN PIN ENKRIPSI
// ==========================================

async function hashPIN(pin) {
    // Perlindungan agar tidak stuck jika browser HP memblokir Web Crypto API
    if (!window.crypto || !window.crypto.subtle) {
        console.warn("Web Crypto API tidak didukung. Menggunakan fallback.");
        return pin; 
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const CORRECT_PIN_HASH = "cd4b0bba7f67328dcff29180fb217d06f0d3a43a95ed32d175797b60e3216f83";

async function checkAccessPin() {
    if (sessionStorage.getItem('perpus_auth') === 'true') {
        fetchData(); 
        return;
    }

    const { value: pin } = await Swal.fire({
        title: '<h3 style="color: #0f172a; margin: 0;"><i class="fa-solid fa-lock"></i> Keamanan Perpustakaan</h3>',
        input: 'password',
        inputPlaceholder: 'Masukkan 6 Digit PIN',
        inputAttributes: { maxlength: 6, style: 'text-align: center; font-size: 1.5rem; letter-spacing: 10px; border-radius: 12px;' },
        allowOutsideClick: false,
        confirmButtonText: 'Lanjut <i class="fa-solid fa-arrow-right"></i>',
        confirmButtonColor: '#3b82f6',
        preConfirm: async (enteredPin) => {
            const hashedInput = await hashPIN(enteredPin.trim());
            // Cek apakah hash cocok (Tidak ada lagi teks "363636" di sini)
            if (hashedInput !== CORRECT_PIN_HASH) {
                Swal.showValidationMessage('PIN salah! Akses ditolak.');
                return false;
            }
            return true;
        }
    });

    if (pin) {
        // --- PROSES OTP ---
        Swal.fire({ title: 'Mengirim OTP...', text: 'Memproses ke email (Tunggu max 5 detik)', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            // PERBAIKAN: Tambahkan header text/plain agar tidak terkena block CORS dari Browser
            const res = await fetch(scriptUrl, { 
                method: 'POST', 
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ action: 'requestOTP' }) 
            });
            const data = await res.json();

            if (data.status === 'success') {
                const { value: otp } = await Swal.fire({
                    title: 'Verifikasi OTP',
                    text: 'Masukkan kode 4-Digit yang dikirim ke Email',
                    input: 'text',
                    inputPlaceholder: 'Kode OTP',
                    // PERBAIKAN: Maksimal panjang karakter diubah jadi 4
                    inputAttributes: { maxlength: 4, style: 'text-align: center; font-size: 1.5rem; letter-spacing: 10px; border-radius: 12px;' },
                    showCancelButton: true,
                    confirmButtonText: 'Verifikasi OTP',
                    preConfirm: async (val) => {
                        const verifyRes = await fetch(scriptUrl, { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({ action: 'verifyOTP', otp: val }) 
                        });
                        const verifyData = await verifyRes.json();
                        if (verifyData.status !== 'success') {
                            Swal.showValidationMessage(verifyData.message);
                            return false;
                        }
                        return true;
                    }
                });

                if (otp) {
                    sessionStorage.setItem('perpus_auth', 'true');
                    Swal.fire({ icon: 'success', title: 'Akses Diberikan', timer: 1500, showConfirmButton: false });
                    fetchData();
                }
            } else {
                Swal.fire('Error', data.message || 'Gagal mengirim OTP', 'error');
            }
        } catch (e) {
            Swal.fire('Error Jaringan', 'Gagal menghubungi server. Pastikan koneksi internet stabil.', 'error');
        }
    }
}

// Inisialisasi awal saat halaman dimuat
document.addEventListener("DOMContentLoaded", checkAccessPin);
