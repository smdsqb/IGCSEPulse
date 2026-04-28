import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const ADMIN_UIDS = ["dEyvyhKqKueCFnWNC1zHiqiIMjj1", "rcqnr0PuqKab08NJ06NqLZTyXmz2"];

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

export async function POST(request) {
  try {
    const { title, body, badge, uid } = await request.json();

    if (!uid || !ADMIN_UIDS.includes(uid)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Missing title or body' }, { status: 400 });
    }

    const db = getAdminDb();
    // Use Timestamp.now() instead of FieldValue.serverTimestamp()
    // serverTimestamp() resolves to null on the client until Firestore confirms,
    // which breaks orderBy("createdAt") queries and hides the doc entirely.
    await db.collection('updates').add({
      title: title.trim(),
      body: body.trim(),
      badge: badge ?? 'New Feature',
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[post-update] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
