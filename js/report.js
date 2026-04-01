import { state }       from './state.js';
import { getHistory, formatDate, getTeacherStats } from './history.js';
import { slotLabel as slotName } from './periods.js';

// ─── Carregamento dinâmico do jsPDF ──────────────────────────────────────────

let _jsPDFLoaded = false;

function loadJsPDF() {
  if (_jsPDFLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s1 = document.createElement('script');
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s1.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s2.onload = () => { _jsPDFLoaded = true; resolve(); };
      s2.onerror = reject;
      document.head.appendChild(s2);
    };
    s1.onerror = reject;
    document.head.appendChild(s1);
  });
}

// ─── Dados do relatório ───────────────────────────────────────────────────────

function buildReportData() {
  const now     = new Date();
  const dateFmt = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });

  // Substituições ativas (semana atual)
  const activeSubs = Object.entries(state.subs).map(([key, subId]) => {
    const [tid, day, slot] = key.split('||');
    const teacher = state.teachers.find(t => t.id === tid);
    const sub     = state.teachers.find(t => t.id === subId);
    return {
      teacher:  teacher?.name ?? 'Removido',
      area:     teacher?.area ?? '',
      day,
      slot:     slotName(slot),
      sub:      sub?.name    ?? 'Removido',
      subArea:  sub?.area    ?? '',
    };
  });

  // Histórico
  const history = getHistory();

  // Carga horária
  const workload = state.teachers
    .map(t => ({ ...t, ...getTeacherStats(t.id) }))
    .sort((a, b) => b.schedules - a.schedules);

  return { dateFmt, activeSubs, history, workload };
}

// ─── Impressão ────────────────────────────────────────────────────────────────

export function printReport() {
  const { dateFmt, activeSubs, history, workload } = buildReportData();

  const activeTbl = activeSubs.length === 0
    ? '<p style="color:#666;font-style:italic">Nenhuma substituição ativa no momento.</p>'
    : `<table class="rt">
        <thead><tr><th>Professor Ausente</th><th>Área</th><th>Dia</th><th>Tempo</th><th>Substituto</th></tr></thead>
        <tbody>${activeSubs.map(r => `
          <tr><td>${r.teacher}</td><td>${r.area}</td><td>${r.day}</td><td>${r.slot}</td><td>${r.sub}</td></tr>
        `).join('')}</tbody>
      </table>`;

  const historyTbl = history.length === 0
    ? '<p style="color:#666;font-style:italic">Sem registros no histórico.</p>'
    : `<table class="rt">
        <thead><tr><th>Data</th><th>Professor Ausente</th><th>Tempo</th><th>Dia</th><th>Substituto</th></tr></thead>
        <tbody>${history.map(r => `
          <tr><td>${formatDate(r.date)}</td><td>${r.teacherName}</td><td>${r.slotLabel}</td><td>${r.day}</td><td>${r.subName}</td></tr>
        `).join('')}</tbody>
      </table>`;

  const workloadTbl = `
    <table class="rt">
      <thead><tr><th>Professor</th><th>Área</th><th>Aulas/sem.</th><th>Faltas</th><th>Subs. dadas</th></tr></thead>
      <tbody>${workload.map(r => `
        <tr><td>${r.name}</td><td>${r.area}</td><td>${r.schedules}</td><td>${r.absences}</td><td>${r.subsGiven}</td></tr>
      `).join('')}</tbody>
    </table>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Relatório — GestãoEscolar</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',sans-serif;font-size:12px;color:#1a1814;padding:24px}
      h1{font-size:20px;font-weight:800;margin-bottom:4px}
      .sub{font-size:12px;color:#6b6760;margin-bottom:24px}
      h2{font-size:14px;font-weight:700;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #1a1814}
      .rt{width:100%;border-collapse:collapse;margin-bottom:16px}
      .rt th{background:#1a1814;color:#fff;padding:6px 10px;text-align:left;font-size:11px}
      .rt td{padding:6px 10px;border-bottom:1px solid #e0ddd6}
      .rt tbody tr:nth-child(even) td{background:#f4f2ee}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>GestãoEscolar — Relatório de Substituições</h1>
    <div class="sub">Gerado em ${dateFmt}</div>
    <h2>Substituições Ativas (Semana Atual)</h2>${activeTbl}
    <h2>Histórico de Substituições</h2>${historyTbl}
    <h2>Carga Horária dos Professores</h2>${workloadTbl}
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─── Exportar PDF ─────────────────────────────────────────────────────────────

export async function exportPDF() {
  try {
    await loadJsPDF();
  } catch (e) {
    alert('Falha ao carregar biblioteca de PDF. Verifique sua conexão.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { dateFmt, activeSubs, history, workload } = buildReportData();

  const margin = 14;
  let y = 18;

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('GestãoEscolar — Relatório de Substituições', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Gerado em ${dateFmt}`, margin, y);
  doc.setTextColor(0);
  y += 10;

  // Seção: substituições ativas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Substituições Ativas (Semana Atual)', margin, y);
  y += 4;

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Professor Ausente', 'Área', 'Dia', 'Tempo', 'Substituto']],
    body: activeSubs.length > 0
      ? activeSubs.map(r => [r.teacher, r.area, r.day, r.slot, r.sub])
      : [['Nenhuma substituição ativa', '', '', '', '']],
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [26, 24, 20], textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 242, 238] },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Seção: histórico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Histórico de Substituições', margin, y);
  y += 4;

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Data', 'Ausente', 'Tempo', 'Dia', 'Substituto']],
    body: history.length > 0
      ? history.map(r => [formatDate(r.date), r.teacherName, r.slotLabel, r.day, r.subName])
      : [['Sem registros', '', '', '', '']],
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [26, 24, 20], textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 242, 238] },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Seção: carga horária (nova página se necessário)
  if (y > 220) { doc.addPage(); y = 18; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Carga Horária dos Professores', margin, y);
  y += 4;

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Professor', 'Área', 'Aulas/sem.', 'Faltas', 'Subs. dadas']],
    body: workload.map(r => [r.name, r.area, r.schedules, r.absences, r.subsGiven]),
    styles:     { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [26, 24, 20], textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 242, 238] },
  });

  doc.save(`gestao_relatorio_${new Date().toISOString().split('T')[0]}.pdf`);
}
