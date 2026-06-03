import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, ShadingType, VerticalAlign,
  HeadingLevel, BorderStyle,
} from 'docx';

const FONT = 'Times New Roman';
const HEADER_BG   = '1F4E79'; // xanh đậm
const TOTAL_BG    = 'D6E4F0'; // xanh nhạt
const SUBTOTAL_BG = 'EBF3FB';

const fmtMoney   = (n) => (n || 0).toLocaleString('vi-VN') + ' đ';
const fmtDate    = (s) => { const [y, m, d] = (s || '').split('-'); return d ? `${d}/${m}/${y}` : s; };
const fmtDT      = (s) => s ? new Date(s).toLocaleString('vi-VN') : '';

// ── Helpers ─────────────────────────────────────────────────────────────────

function run(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: 20, ...opts });
}

function cell(children, width, align = AlignmentType.LEFT, shading = null) {
  const para = new Paragraph({
    alignment: align,
    children: Array.isArray(children) ? children : [children],
    spacing: { before: 60, after: 60 },
  });
  const cfg = {
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [para],
  };
  if (shading) cfg.shading = { type: ShadingType.CLEAR, fill: shading };
  return new TableCell(cfg);
}

function hCell(text, width) {
  return cell(run(text, { bold: true, color: 'FFFFFF', size: 19 }), width, AlignmentType.CENTER, HEADER_BG);
}

function tCell(text, width, align = AlignmentType.RIGHT) {
  return cell(run(text, { bold: true, size: 20 }), width, align, TOTAL_BG);
}

function stCell(text, width, align = AlignmentType.RIGHT) {
  return cell(run(text, { size: 19 }), width, align, SUBTOTAL_BG);
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { before: 100, after: 100 },
    ...opts,
  });
}

function sectionTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [run(text, { bold: true, size: 22 })],
  });
}

// ── Bảng tổng kết ────────────────────────────────────────────────────────────

function buildSummaryTable(data) {
  const W = [3600, 1800, 2100, 1800]; // Hạng mục | SL | Chi phí | %tổng
  const totalCost = data.totalCost || 1;
  const fishPct  = totalCost > 0 ? ((data.totalFishCost / totalCost) * 100).toFixed(1) : '0.0';
  const accPct   = totalCost > 0 ? ((data.totalAccCost  / totalCost) * 100).toFixed(1) : '0.0';

  return new Table({
    width: { size: 9300, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('Hạng mục',               W[0]),
        hCell('Số lượng hao hụt',        W[1]),
        hCell('Chi phí ước tính (đ)',     W[2]),
        hCell('Tỷ lệ',                   W[3]),
      ]}),
      new TableRow({ children: [
        cell(run('Cá (các loài)',      { size: 20 }), W[0]),
        cell(run(`${data.totalFishLoss} con`), W[1], AlignmentType.CENTER),
        cell(run(fmtMoney(data.totalFishCost)), W[2], AlignmentType.RIGHT),
        cell(run(`${fishPct}%`),       W[3], AlignmentType.CENTER),
      ]}),
      new TableRow({ children: [
        cell(run('Phụ kiện / Thiết bị', { size: 20 }), W[0]),
        cell(run(`${data.totalAccLoss} cái`), W[1], AlignmentType.CENTER),
        cell(run(fmtMoney(data.totalAccCost)), W[2], AlignmentType.RIGHT),
        cell(run(`${accPct}%`),        W[3], AlignmentType.CENTER),
      ]}),
      new TableRow({ children: [
        tCell('TỔNG CỘNG',                           W[0], AlignmentType.LEFT),
        tCell(`${data.totalFishLoss + data.totalAccLoss}`, W[1], AlignmentType.CENTER),
        tCell(fmtMoney(data.totalCost),               W[2]),
        tCell('100%',                                  W[3], AlignmentType.CENTER),
      ]}),
    ],
  });
}

// ── Bảng theo kỳ ─────────────────────────────────────────────────────────────

function buildPeriodTable(data, groupBy) {
  const W = [1100, 1300, 1600, 1300, 1600, 1500, 900];
  // Kỳ | Hao hụt cá | CP cá | Hao hụt PK | CP PK | Tổng CP | NV ghi nhận

  const header = new TableRow({ tableHeader: true, children: [
    hCell(groupBy === 'day' ? 'Ngày' : 'Tháng', W[0]),
    hCell('Hao hụt cá',    W[1]),
    hCell('Chi phí cá',    W[2]),
    hCell('Hao hụt PK/TB', W[3]),
    hCell('Chi phí PK/TB', W[4]),
    hCell('Tổng chi phí',  W[5]),
    hCell('Số lần GN',     W[6]),
  ]});

  const dataRows = data.periods.map(p => new TableRow({ children: [
    cell(run(p.period, { bold: true }),           W[0], AlignmentType.CENTER),
    cell(run(p.fishLoss > 0 ? `${p.fishLoss} con`  : '—'), W[1], AlignmentType.CENTER),
    cell(run(fmtMoney(p.fishCost)),               W[2], AlignmentType.RIGHT),
    cell(run(p.accLoss  > 0 ? `${p.accLoss} cái`   : '—'), W[3], AlignmentType.CENTER),
    cell(run(fmtMoney(p.accCost)),                W[4], AlignmentType.RIGHT),
    cell(run(fmtMoney(p.totalCost), { bold: true }), W[5], AlignmentType.RIGHT),
    cell(run(String(p.records.length)),           W[6], AlignmentType.CENTER),
  ]}));

  const totals = new TableRow({ children: [
    tCell('TỔNG',                                          W[0], AlignmentType.CENTER),
    tCell(`${data.totalFishLoss} con`,                     W[1], AlignmentType.CENTER),
    tCell(fmtMoney(data.totalFishCost),                    W[2]),
    tCell(`${data.totalAccLoss} cái`,                      W[3], AlignmentType.CENTER),
    tCell(fmtMoney(data.totalAccCost),                     W[4]),
    tCell(fmtMoney(data.totalCost),                        W[5]),
    tCell(String(data.totalRecords),                       W[6], AlignmentType.CENTER),
  ]});

  return new Table({
    width: { size: 9300, type: WidthType.DXA },
    rows: [header, ...dataRows, totals],
  });
}

// ── Bảng chi tiết ─────────────────────────────────────────────────────────────

function buildDetailTable(data) {
  const W = [1500, 700, 1800, 750, 1100, 1300, 1350, 800];
  // Ngày giờ | Loại | Tên | SL | Đơn giá | Thành tiền | Lý do | NV

  const header = new TableRow({ tableHeader: true, children: [
    hCell('Ngày giờ',    W[0]),
    hCell('Loại',        W[1]),
    hCell('Tên hàng',    W[2]),
    hCell('SL hao hụt',  W[3]),
    hCell('Đơn giá',     W[4]),
    hCell('Thành tiền',  W[5]),
    hCell('Lý do',       W[6]),
    hCell('Nhân viên',   W[7]),
  ]});

  const allRecords = data.periods.flatMap(p => p.records);
  const detailRows = allRecords.map(r => new TableRow({ children: [
    cell(run(fmtDT(r.created), { size: 18 }), W[0]),
    cell(run(r.targetType === 'Fish' ? 'Cá' : 'PK/TB', { size: 18 }), W[1], AlignmentType.CENTER),
    cell(run(r.targetName, { size: 18 }), W[2]),
    cell(run(String(r.lossAmount)), W[3], AlignmentType.CENTER),
    cell(run(fmtMoney(r.unitPrice)), W[4], AlignmentType.RIGHT),
    cell(run(fmtMoney(r.totalCost), { bold: true }), W[5], AlignmentType.RIGHT),
    cell(run(r.reason || '—', { size: 18 }), W[6]),
    cell(run(r.staffName || '—', { size: 18 }), W[7]),
  ]}));

  // Dòng tổng
  const sumCost = allRecords.reduce((s, r) => s + (r.totalCost || 0), 0);
  const sumQty  = allRecords.reduce((s, r) => s + (r.lossAmount || 0), 0);
  const totalRow = new TableRow({ children: [
    tCell('TỔNG CỘNG', W[0] + W[1] + W[2], AlignmentType.LEFT),
    tCell(String(sumQty), W[3], AlignmentType.CENTER),
    tCell('', W[4]),
    tCell(fmtMoney(sumCost), W[5]),
    tCell('', W[6] + W[7]),
  ]});

  return new Table({
    width: { size: 9300, type: WidthType.DXA },
    rows: [header, ...detailRows, totalRow],
  });
}

// ── Hàm chính ──────────────────────────────────────────────────────────────────

export async function exportWarehouseReportToWord(reportData, reportFrom, reportTo, groupBy) {
  const today    = new Date().toLocaleDateString('vi-VN');
  const fromStr  = fmtDate(reportFrom);
  const toStr    = fmtDate(reportTo);
  const kindLbl  = groupBy === 'day' ? 'ngày' : 'tháng';

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 851, bottom: 1134, left: 1134 },
        },
      },
      children: [
        // ── TIÊU ĐỀ ─────────────────────────────────────────────────
        para(run('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 20 }), {
          alignment: AlignmentType.CENTER, spacing: { after: 0, before: 0 },
        }),
        para(run('Độc lập - Tự do - Hạnh phúc', { italics: true, size: 20 }), {
          alignment: AlignmentType.CENTER, spacing: { after: 60, before: 0 },
        }),
        para(run('─────────────────────────────────────', { size: 14, color: '888888' }), {
          alignment: AlignmentType.CENTER, spacing: { after: 200, before: 0 },
        }),

        para(run('BÁO CÁO HAO HỤT KHO', { bold: true, size: 28 }), {
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100 },
        }),
        para(run(`Kỳ báo cáo: ${fromStr} – ${toStr}`, { italics: true, size: 22 }), {
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 },
        }),
        para(run(`Ngày xuất báo cáo: ${today}`, { size: 20, color: '555555' }), {
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 300 },
        }),

        // ── I. TỔNG KẾT ─────────────────────────────────────────────
        sectionTitle('I. TỔNG KẾT HAO HỤT'),
        buildSummaryTable(reportData),

        // ── II. CHI TIẾT THEO KỲ ────────────────────────────────────
        sectionTitle(`II. THỐNG KÊ THEO ${kindLbl.toUpperCase()}`),
        buildPeriodTable(reportData, groupBy),

        // ── III. DANH SÁCH CHI TIẾT ──────────────────────────────────
        sectionTitle('III. DANH SÁCH HAO HỤT CHI TIẾT'),
        ...(reportData.totalRecords === 0
          ? [para(run('Không có dữ liệu trong kỳ này.', { italics: true, color: '888888' }))]
          : [buildDetailTable(reportData)]
        ),

        // ── GHI CHÚ ──────────────────────────────────────────────────
        para(run(
          '(*) Chi phí ước tính dựa trên đơn giá hiện tại của sản phẩm trong hệ thống.',
          { italics: true, size: 18, color: '666666' }
        ), { spacing: { before: 300, after: 500 } }),

        // ── CHỮ KÝ ───────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 80 },
          children: [run(`............, ngày ${today}`, { italics: true, size: 20 })],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 80 },
          children: [run('NGƯỜI LẬP BÁO CÁO', { bold: true, size: 20 })],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 80 },
          children: [run('(Ký tên, ghi rõ họ tên)', { italics: true, size: 18, color: '666666' })],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200, after: 0 },
          children: [run('..........................................', { size: 20 })],
        }),
      ],
    }],
  });

  // Dùng toBlob() thay vì toBuffer() vì toBuffer() chỉ chạy được trên Node.js
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `BaoCaoHaoHut_${reportFrom}_${reportTo}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
