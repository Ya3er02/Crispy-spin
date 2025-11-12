import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  const nonce = randomBytes(16).toString('hex');

  return NextResponse.json({ nonce });
}
