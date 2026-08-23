import { CanvasFactory } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const result = await parser.getText();
    const text = result.text?.trim();
    if (!text) {
      throw new Error('PDF contained no extractable text (it may be a scanned image without OCR)');
    }
    return text;
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  if (fileName.endsWith('.pdf')) {
    return extractTextFromPDF(buffer);
  }

  // For other file types, try to treat as text
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    throw new Error('Unsupported file format');
  }
}
