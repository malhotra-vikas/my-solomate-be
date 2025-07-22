import fetch, { Headers, Response } from 'node-fetch';
globalThis.fetch = fetch;
globalThis.Headers = Headers;
globalThis.Response = Response;

import admin from 'firebase-admin';
import fs from 'fs/promises';

import { initializeApp } from 'firebase/app';
import { signInWithCustomToken, getAuth } from 'firebase/auth';

import dotenv from 'dotenv';
dotenv.config();

// ✅ Hardcoded Firebase Web SDK Config
const firebaseConfig = {
    apiKey: "AIzaSyBRsxnaPdCcAcYmvj0JM9Spkz2-Gitiamg",
    authDomain: "mysolomate.firebaseapp.com",
    projectId: "mysolomate",
    storageBucket: "mysolomate.appspot.com",
    messagingSenderId: "347203906857",
    appId: "1:347203906857:web:c43736f211323eed66db38"
};
const jsonPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!jsonPath) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS not set in .env");
    process.exit(1);
}

const serviceAccount = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));

// 🔧 Initialize Admin SDK

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized");

}


// 🔧 Initialize Firebase App SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export async function getFirebaseIdTokenByEmail(email) {
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        console.error(`📥 UID for email ${email} is: ${userRecord.uid}`);

        const customToken = await admin.auth().createCustomToken(userRecord.uid);
        console.error(`🔐 Created custom token for UID: ${userRecord.uid}`);

        const userCredential = await signInWithCustomToken(auth, customToken);
        const idToken = await userCredential.user.getIdToken();

        console.log(idToken);
        return idToken;
    } catch (err) {
        console.error('❌ Error generating Firebase ID token:', err);
        process.exit(1);
    }
}

// If called directly (not imported), run with command line args
if (import.meta.url === `file://${process.argv[1]}`) {
    const email = process.argv[2];
    if (!email) {
        console.error("⚠️ Usage: node getFirebaseIdToken.ts <email>");
        process.exit(1);
    }
    getFirebaseIdTokenByEmail(email);

}