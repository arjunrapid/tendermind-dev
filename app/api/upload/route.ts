import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromFile } from '@/lib/pdf';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (
      !file.type.includes('pdf') &&
      !file.type.includes('text') &&
      !file.name.endsWith('.pdf')
    ) {
      return NextResponse.json(
        { error: 'Only PDF and text files are supported' },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const extractedText = await extractTextFromFile(
      Buffer.from(buffer),
      file.name,
    );

    return NextResponse.json({
      fileName: file.name,
      extractedText,
      size: file.size,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 },
    );
  }
}
