const PINATA_API_KEY    = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
  console.warn('Pinata API keys not configured — IPFS uploads will fail');
}

export async function uploadFileToPinata(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      pinata_api_key:        PINATA_API_KEY!,
      pinata_secret_api_key: PINATA_SECRET_KEY!,
    },
    body: form,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Pinata file upload failed: ${msg}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
}

export async function uploadJsonToPinata(content: object, name: string): Promise<string> {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type':        'application/json',
      pinata_api_key:        PINATA_API_KEY!,
      pinata_secret_api_key: PINATA_SECRET_KEY!,
    },
    body: JSON.stringify({
      pinataContent:  content,
      pinataMetadata: { name },
      pinataOptions:  { cidVersion: 1 },
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Pinata JSON upload failed: ${msg}`);
  }

  const data = await res.json();
  return data.IpfsHash as string;
}

export function ipfsUrl(cid: string): string {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs/';
  return `${gateway}${cid}`;
}
