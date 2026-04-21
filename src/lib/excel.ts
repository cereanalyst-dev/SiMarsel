import * as XLSX from 'xlsx';

export const findSheet = (
  sheetNames: string[],
  keywords: string[],
): string | undefined =>
  sheetNames.find((s) =>
    keywords.some((k) => s.toLowerCase().includes(k.toLowerCase())),
  );

export interface ParsedWorkbook {
  transactions: unknown[];
  downloaders: unknown[];
}

export const parseWorkbook = (workbook: XLSX.WorkBook): ParsedWorkbook => {
  const sheetNames = workbook.SheetNames;

  const txSheetName = findSheet(sheetNames, ['transaksi', 'trx', 'paid']);
  const txSheet = txSheetName ? workbook.Sheets[txSheetName] : workbook.Sheets[sheetNames[0]];
  const transactions = txSheet ? XLSX.utils.sheet_to_json(txSheet) : [];

  const dlSheetName = findSheet(sheetNames, ['downloader', 'download']);
  let downloaders: unknown[] = [];
  if (dlSheetName) {
    downloaders = XLSX.utils.sheet_to_json(workbook.Sheets[dlSheetName]);
  } else if (sheetNames.length > 1) {
    downloaders = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[1]]);
  }

  return { transactions, downloaders };
};

export const readWorkbookFromFile = (file: File): Promise<XLSX.WorkBook> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Failed to read file');
        resolve(XLSX.read(data, { type: 'array' }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
