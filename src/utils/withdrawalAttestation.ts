import type { Person } from "../types";
import { formatBirthDate } from "./birthDate";

export type WithdrawalAttestationInput = {
  churchName: string;
  person: Pick<Person, "name" | "birthDate">;
  withdrawCongregation: boolean;
  withdrawDenomination: boolean;
  withdrawalDate: string;
};

const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Minimal Word document for utmeldingsattest (Office Open XML). */
export function buildWithdrawalAttestationDocx(input: WithdrawalAttestationInput): Blob {
  const scope = [
    input.withdrawCongregation ? "menigheten" : null,
    input.withdrawDenomination ? "trossamfunnet" : null,
  ]
    .filter(Boolean)
    .join(" og ");

  const birth = input.person.birthDate ? formatBirthDate(input.person.birthDate) : "–";
  const withdrawn = formatBirthDate(input.withdrawalDate);

  const lines = [
    "Utmeldingsattest",
    "",
    input.churchName,
    "",
    `Navn: ${input.person.name}`,
    `Fødselsdato: ${birth}`,
    "",
    `Meldt ut av ${scope} med virkning fra ${withdrawn}.`,
    "",
    "Bekreftelse og attest bør sendes til vedkommende. Brev er sterkt anbefalt.",
    "",
    `Sted, dato: _______________________`,
    "",
    `Signatur protokollansvarlig: _______________________`,
  ];

  const body = lines
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return buildDocxZip({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rels,
    "word/document.xml": documentXml,
  });
}

/** Very small store-only ZIP builder for .docx. */
function buildDocxZip(files: Record<string, string>): Blob {
  const parts: { name: string; data: Uint8Array }[] = [];
  for (const [name, content] of Object.entries(files)) {
    parts.push({ name, data: new TextEncoder().encode(content) });
  }
  return new Blob([zipStore(parts)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const central: Uint8Array[] = [];

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length + file.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint32(18, crc, true);
    view.setUint32(22, file.data.length, true);
    view.setUint32(14, file.data.length, true);
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);
    chunks.push(local);
    offset += local.length;

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(centralHeader.buffer);
    cview.setUint32(0, 0x02014b50, true);
    cview.setUint16(4, 20, true);
    cview.setUint16(6, 20, true);
    cview.setUint16(28, nameBytes.length, true);
    cview.setUint32(20, crc, true);
    cview.setUint32(24, file.data.length, true);
    cview.setUint32(16, file.data.length, true);
    cview.setUint32(42, offset - local.length, true);
    centralHeader.set(nameBytes, 46);
    central.push(centralHeader);
  }

  const centralSize = central.reduce((n, part) => n + part.length, 0);
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  eview.setUint32(0, 0x06054b50, true);
  eview.setUint16(8, files.length, true);
  eview.setUint16(10, files.length, true);
  eview.setUint32(12, centralSize, true);
  eview.setUint32(16, offset, true);

  const total = new Uint8Array(offset + centralSize + 22);
  let pos = 0;
  for (const chunk of chunks) {
    total.set(chunk, pos);
    pos += chunk.length;
  }
  for (const chunk of central) {
    total.set(chunk, pos);
    pos += chunk.length;
  }
  total.set(end, pos);
  return total;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** For e-postvedlegg der attesten sendes fra serveren. */
export async function withdrawalAttestationDocxBase64(input: WithdrawalAttestationInput): Promise<string> {
  const blob = buildWithdrawalAttestationDocx(input);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export const withdrawalAttestationEmailSubject = (personName: string) => `Utmeldingsattest – ${personName}`;

export function withdrawalAttestationEmailText(churchName: string): string {
  return [
    "Hei,",
    "",
    "Vedlagt følger utmeldingsattest.",
    "",
    "Ta kontakt med menigheten hvis noe skulle være feil.",
    "",
    `Med vennlig hilsen`,
    churchName,
  ].join("\n");
}

export function downloadWithdrawalAttestation(input: WithdrawalAttestationInput, fileStem: string): void {
  const blob = buildWithdrawalAttestationDocx(input);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileStem}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}