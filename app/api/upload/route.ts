import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToPinata } from '@/lib/pinata';

const PINATA_CONFIGURED = !!(process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY);

export async function POST(request: NextRequest) {
  if (!PINATA_CONFIGURED) {
    return NextResponse.json(
      { error: 'IPFS storage is not configured. Add PINATA_API_KEY and PINATA_SECRET_KEY to .env to enable file uploads.' },
      { status: 503 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const cid = await uploadFileToPinata(file);
    const url = `${process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/'}${cid}`;

    return NextResponse.json({ cid, url });
  } catch (error) {
    console.error('POST /api/upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
