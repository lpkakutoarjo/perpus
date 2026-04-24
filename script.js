// GANTI DENGAN URL DEPLOYMENT GOOGLE APPS SCRIPT ANDA YANG BARU
const scriptUrl = "https://script.google.com/macros/s/AKfycbzdcPz4vDmqYfAwN2dHXiLjLAYY-qhlczBGFbDrd0066us4gpY7_mNKiWI9pCOg8WQ/exec";

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
// FUNGSI RENDER TABEL
// ==========================================

function renderTableDashboard() {
    const tbody = document.getElementById('tbody-dash-pinjam');
    if(!tbody) return;
    const limit = document.getElementById('limit-dash-pinjam').value;
    const search = document.getElementById('search-dash-pinjam').value.toLowerCase();
    
    // Copy dan balik array agar data terbawah (terbaru dari sheet) otomatis naik ke atas
    let dataMundur = [...dataPinjam].reverse();
    
    let filtered = dataMundur.filter(row => {
        let statusVal = row[7] ? String(row[7]).trim().toLowerCase() : '';
        return statusVal.includes('belum') &&
        ((row[0]||'').toString().toLowerCase().includes(search) || (row[1]||'').toString().toLowerCase().includes(search) || (row[2]||'').toString().toLowerCase().includes(search));
    });
    
    // Urutkan spesifik berdasarkan tanggal pinjam (Terbaru - Terlama)
    filtered.sort((a, b) => {
        let dateA = new Date(a[5]);
        let dateB = new Date(b[5]);
        return (!isNaN(dateA) && !isNaN(dateB)) ? dateB - dateA : 0;
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
    if(!tbody) return;
    const limit = document.getElementById('limit-peminjaman').value;
    const search = document.getElementById('search-peminjaman').value.toLowerCase();
    
    // Copy dan balik array agar data terbawah (terbaru dari sheet) otomatis naik ke atas
    let dataMundur = [...dataPinjam].reverse();

    let filtered = dataMundur.filter(row => 
        (row[0]||'').toString().toLowerCase().includes(search) || 
        (row[1]||'').toString().toLowerCase().includes(search) || 
        (row[2]||'').toString().toLowerCase().includes(search) ||
        (row[3]||'').toString().toLowerCase().includes(search)
    );

    // Urutkan spesifik berdasarkan tanggal pinjam (Terbaru - Terlama)
    filtered.sort((a, b) => {
        let dateA = new Date(a[5]);
        let dateB = new Date(b[5]);
        return (!isNaN(dateA) && !isNaN(dateB)) ? dateB - dateA : 0;
    });

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
    const limit = document.getElementById('limit-kategori').value;
    const search = document.getElementById('search-kategori').value.toLowerCase();
    
    // Copy dan balik array agar kategori terbaru ada di atas
    let dataMundur = [...dataKategori].reverse();

    let filtered = dataMundur.filter(row => row[1].toLowerCase().includes(search) || row[0].toLowerCase().includes(search));
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
    const limit = document.getElementById('limit-buku').value;
    const search = document.getElementById('search-buku').value.toLowerCase();
    
    // Copy dan balik array agar buku terbaru ada di atas
    let dataMundur = [...dataBuku].reverse();

    let filtered = dataMundur.filter(row => 
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
    const limit = document.getElementById('limit-anggota').value;
    const search = document.getElementById('search-anggota').value.toLowerCase();
    
    let filtered = dataAnggota.filter(row => row[1].toLowerCase().includes(search) || row[2].toLowerCase().includes(search));
    
    // Urutkan Anggota berdasarkan Kode Anggota (Terbesar ke Terkecil)
    filtered.sort((a, b) => {
        let kodeA = String(a[1] || '');
        let kodeB = String(b[1] || '');
        return kodeB.localeCompare(kodeA, undefined, { numeric: true });
    });

    let displayData = limit === 'all' ? filtered : filtered.slice(0, parseInt(limit));

    let rowsHtml = '';
    if (displayData.length === 0) {
        rowsHtml = `<tr><td colspan="8" class="text-center text-muted">Data anggota tidak ditemukan</td></tr>`;
    } else {
        displayData.forEach((row, index) => {
            // Karena Jml Pinjam ada di Kolom A, maka nilainya adalah row[0]
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
// SISTEM KEAMANAN PIN ENKRIPSI
// ==========================================
async function hashPIN(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkAccessPin() {
    if (sessionStorage.getItem('perpus_auth') === 'true') {
        fetchData();
        return;
    }

    const { value: pin } = await Swal.fire({
        title: '<h3 style="color: #0f172a; margin: 0;"><i class="fa-solid fa-lock"></i> Keamanan Perpustakaan</h3>',
        html: '<p style="font-size:0.9rem; color:#64748b; margin-top:5px;">Silakan masukkan PIN akses.</p>',
        input: 'password',
        inputPlaceholder: 'Masukkan 6 Digit PIN',
        inputAttributes: {
            maxlength: 6, autocapitalize: 'off', autocorrect: 'off',
            style: 'text-align: center; font-size: 1.5rem; letter-spacing: 10px; border-radius: 12px;'
        },
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: '<i class="fa-solid fa-key"></i> Buka Akses',
        confirmButtonColor: '#3b82f6',
        customClass: { popup: 'form-glass' },
        preConfirm: async (enteredPin) => {
            if (!enteredPin) {
                Swal.showValidationMessage('<i class="fa-solid fa-circle-exclamation"></i> PIN tidak boleh kosong!');
                return false;
            }
            const hashedPin = await hashPIN(enteredPin.trim());
            // PIN DEFAULT ADALAH: 363636
            const targetHash = await hashPIN("363636");
            
            if (hashedPin !== targetHash) {
                Swal.showValidationMessage('<i class="fa-solid fa-triangle-exclamation"></i> PIN salah! Akses ditolak.');
                return false;
            }
            return true;
        }
    });

    if (pin) {
        sessionStorage.setItem('perpus_auth', 'true');
        Swal.fire({
            icon: 'success', title: 'Akses Diberikan', text: 'Selamat datang di Dashboard Perpustakaan',
            timer: 1500, showConfirmButton: false, customClass: { popup: 'form-glass' }
        });
        fetchData(); 
    }
}

// Inisialisasi awal saat halaman dimuat
document.addEventListener("DOMContentLoaded", checkAccessPin);