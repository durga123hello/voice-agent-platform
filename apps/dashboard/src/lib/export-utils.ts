import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, HeadingLevel, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { User } from '../types/user';
import { Organization } from '../types/organization';
import { Project, resolveLlmModel } from '../types/project';
import { AIAgent } from '../types/agent';

/**
 * Export filtered users list to Excel (.xlsx)
 */
export function exportToExcel(users: User[], filename = 'vopx-users.xlsx') {
  const data = users.map((u) => ({
    'Employee ID': u.employeeId,
    'Name': u.name,
    'Role': u.role,
    'Status': u.status,
    'Phone': u.phone || '—',
    'Email': u.email,
    'Joined Date': u.joinedDate,
    'Nationality': u.nationality || '—',
    'Gender': u.gender || '—'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

  // Auto-width columns
  const colWidths = [
    { wch: 15 }, // Employee ID
    { wch: 22 }, // Name
    { wch: 20 }, // Role
    { wch: 14 }, // Status
    { wch: 18 }, // Phone
    { wch: 28 }, // Email
    { wch: 18 }, // Joined Date
    { wch: 16 }, // Nationality
    { wch: 10 }  // Gender
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export filtered users list to PDF (.pdf)
 */
export function exportToPdf(users: User[], filename = 'vopx-users.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Document Title & Branding
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110); // Brand Teal #0f766e
  doc.text('vopx — User Management Directory', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Exported on ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })} • Total Records: ${users.length}`, 14, 25);

  const head = [['Employee ID', 'Name', 'Role', 'Status', 'Phone', 'Email', 'Joined Date']];
  const body = users.map((u) => [
    u.employeeId || '',
    u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.officialEmail || '',
    u.role || '',
    u.status || '',
    u.phone || u.phoneNumber || '—',
    u.email || u.officialEmail || '',
    u.joinedDate || u.dateOfJoining || ''
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 118, 110], // Brand Teal
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  doc.save(filename);
}

/**
 * Export filtered users list to Word (.docx)
 */
export async function exportToWord(users: User[], filename = 'vopx-users.docx') {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ width: { size: 1400, type: WidthType.DXA }, children: [new Paragraph({ text: "Emp ID", style: "HeaderStyle" })] }),
        new TableCell({ width: { size: 2200, type: WidthType.DXA }, children: [new Paragraph({ text: "Name", style: "HeaderStyle" })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ text: "Role", style: "HeaderStyle" })] }),
        new TableCell({ width: { size: 1400, type: WidthType.DXA }, children: [new Paragraph({ text: "Status", style: "HeaderStyle" })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ text: "Phone", style: "HeaderStyle" })] }),
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [new Paragraph({ text: "Email", style: "HeaderStyle" })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ text: "Joined", style: "HeaderStyle" })] }),
      ],
    }),
    ...users.map((u) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(u.employeeId || '')] }),
          new TableCell({ children: [new Paragraph(u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.officialEmail || '')] }),
          new TableCell({ children: [new Paragraph(u.role || '')] }),
          new TableCell({ children: [new Paragraph(u.status || '')] }),
          new TableCell({ children: [new Paragraph(u.phone || u.phoneNumber || "—")] }),
          new TableCell({ children: [new Paragraph(u.email || u.officialEmail || '')] }),
          new TableCell({ children: [new Paragraph(u.joinedDate || u.dateOfJoining || '')] }),
        ],
      })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "vopx — User Directory Export",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Export Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })} | Total Users: ${users.length}`,
                color: "64748b",
                size: 20,
              }),
            ],
            spacing: { after: 300 },
          }),
          new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

/* =========================================================================
   ORGANIZATIONS EXPORTS
   ========================================================================= */

export function exportOrgsToExcel(orgs: Organization[], filename = 'vopx-organizations.xlsx') {
  const data = orgs.map((o) => ({
    'Organization Name': o.name,
    'Organization Code': o.code,
    'Email': o.email,
    'Phone': o.phone,
    'Country': o.country,
    'Created At': o.createdAt,
    'Status': o.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Organizations');
  XLSX.writeFile(workbook, filename);
}

export function exportOrgsToPdf(orgs: Organization[], filename = 'vopx-organizations.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110);
  doc.text('vopx — Organizations Directory', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Exported on ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })} • Total Records: ${orgs.length}`, 14, 25);

  const head = [['Organization Name', 'Code', 'Email', 'Phone', 'Country', 'Created', 'Status']];
  const body = orgs.map((o) => [o.name, o.code, o.email, o.phone, o.country, o.createdAt, o.status]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(filename);
}

export async function exportOrgsToWord(orgs: Organization[], filename = 'vopx-organizations.docx') {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ text: "Name" })] }),
        new TableCell({ width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ text: "Code" })] }),
        new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ text: "Email" })] }),
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ text: "Phone" })] }),
        new TableCell({ width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ text: "Country" })] }),
        new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [new Paragraph({ text: "Status" })] }),
      ],
    }),
    ...orgs.map((o) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(o.name)] }),
          new TableCell({ children: [new Paragraph(o.code)] }),
          new TableCell({ children: [new Paragraph(o.email)] }),
          new TableCell({ children: [new Paragraph(o.phone)] }),
          new TableCell({ children: [new Paragraph(o.country)] }),
          new TableCell({ children: [new Paragraph(o.status)] }),
        ],
      })
    ),
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "vopx — Organizations Directory", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

/* =========================================================================
   PROJECTS EXPORTS
   ========================================================================= */

export function exportProjectsToExcel(projects: Project[], filename = 'vopx-projects.xlsx') {
  const data = projects.map((p) => ({
    'Project ID': p.projectId,
    'Project Name': p.name,
    'Description': p.description,
    'Status': p.status,
    'STT Engine': p.stt,
    'TTS Engine': p.tts,
    'LLM Model': resolveLlmModel(p),
    'Created At': p.createdAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
  XLSX.writeFile(workbook, filename);
}

export function exportProjectsToPdf(projects: Project[], filename = 'vopx-projects.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110);
  doc.text('vopx — Projects Directory', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Exported on ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })} • Total Records: ${projects.length}`, 14, 25);

  const head = [['Project ID', 'Name', 'Description', 'Status', 'STT', 'TTS', 'LLM Model']];
  const body = projects.map((p) => [p.projectId, p.name, p.description, p.status, p.stt, p.tts, resolveLlmModel(p)]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(filename);
}

export async function exportProjectsToWord(projects: Project[], filename = 'vopx-projects.docx') {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ text: "ID" })] }),
        new TableCell({ width: { size: 2400, type: WidthType.DXA }, children: [new Paragraph({ text: "Name" })] }),
        new TableCell({ width: { size: 1400, type: WidthType.DXA }, children: [new Paragraph({ text: "Status" })] }),
        new TableCell({ width: { size: 2000, type: WidthType.DXA }, children: [new Paragraph({ text: "STT" })] }),
        new TableCell({ width: { size: 2000, type: WidthType.DXA }, children: [new Paragraph({ text: "TTS" })] }),
        new TableCell({ width: { size: 2200, type: WidthType.DXA }, children: [new Paragraph({ text: "Model" })] }),
      ],
    }),
    ...projects.map((p) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(p.projectId)] }),
          new TableCell({ children: [new Paragraph(p.name)] }),
          new TableCell({ children: [new Paragraph(p.status)] }),
          new TableCell({ children: [new Paragraph(p.stt)] }),
          new TableCell({ children: [new Paragraph(p.tts)] }),
          new TableCell({ children: [new Paragraph(resolveLlmModel(p))] }),
        ],
      })
    ),
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "vopx — Projects Directory", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

/* =========================================================================
   AI AGENTS EXPORTS
   ========================================================================= */

export function exportAgentsToExcel(agents: AIAgent[], filename = 'vopx-agents.xlsx') {
  const data = agents.map((a) => ({
    'Agent ID': a.agentId,
    'Name': a.name,
    'Provider': a.provider,
    'Available Models': a.availableModels,
    'Status': a.status,
    'Created At': a.createdAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'AI Agents');
  XLSX.writeFile(workbook, filename);
}

export function exportAgentsToPdf(agents: AIAgent[], filename = 'vopx-agents.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110);
  doc.text('vopx — AI Voice Agents Directory', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Exported on ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })} • Total Records: ${agents.length}`, 14, 25);

  const head = [['Agent ID', 'Name', 'Provider', 'Available Models', 'Status', 'Created']];
  const body = agents.map((a) => [a.agentId, a.name, a.provider, a.availableModels, a.status, a.createdAt]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  doc.save(filename);
}

export async function exportAgentsToWord(agents: AIAgent[], filename = 'vopx-agents.docx') {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ width: { size: 1600, type: WidthType.DXA }, children: [new Paragraph({ text: "Agent ID" })] }),
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [new Paragraph({ text: "Name" })] }),
        new TableCell({ width: { size: 2000, type: WidthType.DXA }, children: [new Paragraph({ text: "Provider" })] }),
        new TableCell({ width: { size: 2800, type: WidthType.DXA }, children: [new Paragraph({ text: "Models" })] }),
        new TableCell({ width: { size: 1400, type: WidthType.DXA }, children: [new Paragraph({ text: "Status" })] }),
      ],
    }),
    ...agents.map((a) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(a.agentId)] }),
          new TableCell({ children: [new Paragraph(a.name)] }),
          new TableCell({ children: [new Paragraph(a.provider)] }),
          new TableCell({ children: [new Paragraph(a.availableModels)] }),
          new TableCell({ children: [new Paragraph(a.status)] }),
        ],
      })
    ),
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "vopx — AI Voice Agents Directory", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
