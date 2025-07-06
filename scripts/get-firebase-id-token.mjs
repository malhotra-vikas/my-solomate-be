import fetch, { Headers, Response } from 'node-fetch';
globalThis.fetch = fetch;
globalThis.Headers = Headers;
globalThis.Response = Response;

import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { signInWithCustomToken, getAuth } from 'firebase/auth';

// 🔐 Hardcoded Firebase Admin SDK Service Account
const serviceAccount = {
    "type": "service_account",
    "project_id": "mysolomate",
    "private_key_id": "fc3ad132a43cbcbfabf3af1b322ddeceb6ff7fde",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCxruALJtbhYYP7\nNcwZ5KIk7cMgOhb/7FIsxDdtpJISCKRDWfL9qroCW5CAwj9ezyX35PmGgMxPNOR0\n1xqBVS0gA6+MD5bhjrlXtTMbV9J+3aep3xtrLtz0XJqXUSNlSehevA34uzeqVQCm\nhziKhSwrdvQT09Eo6Wq472yzFIiFBwm09hFTIDts8XMNq4436Qs1j17ABMMTO7F6\noQlsyQTqAj7UpWgK94RpbgCCGV9tIdlk+L4DeozS1T9j65a9GRBUC2oLVeVfsDaC\nmlvbtgbEB2Ooq0zwXMjbaD4faFcDMKXxGGGeWO8rs3KOoDZ6PzmrxlEawTTV2xPV\n+Jo60H+LAgMBAAECggEAHS3dQCeUMTYM8ROwHW51DEB5g1DW1xdtlUlx2tEkZc7C\nfwcGBw9i9aEo1WRQ+NZm41NYgPSk2LsUa3WptiSRQQkp6oPi4M7J9DPfHTXqbQgk\nkRqBC7SJ950/i+r4t5kQDoKufrLsHM5RyYc6S1E8ZDToN1tZJXFTo+Q5wxzzoHi1\nU2qx919W0VQBe+oAgjWI4YnhImmjFps4z/qBW9+/FZ55+27bZUqz4T3a2WUEFrRx\nlcuGuu/GenyIj+BVW/S1c3se/qR73Jo6f7dTzq67A/WP/etEHivx8SsUuOf8Ou2B\nrCcZcwIJ7JLRcdkKR3kpR+f+b8UeXpTl9xlzTwjp1QKBgQDxSnKQ+fqvRdp48QJA\n/T/KW50lRWn/cLS79+ZKTRr0VFJq0eBEFf0X/4IKTK16F6z9Rlhy3KiloJDTFeGd\n6WfgFitsbiM0T5jul1G2anvjWBCom5p331RmuNn4DBLFbveFYa5CvdQXjwp1cwSZ\nx47fdB9memal9+UyyRwDGUFatwKBgQC8g8YzbwLKikhlwjzx7qy/baovAYmpbbDA\n4/74M6t5GtpbDDqc91e1keCKy7TcVlwORHGWrIvdy2c1mTfQgJTKMaizNEoAiu7g\no+rI9HqeSQstGEloONBXElhIDNLiLlEpLdAaF+rgCqFaVZNOwwsaXIm8BdMjrmS1\n0ZaW58z9zQKBgQDhFH9Webm88j5f/wIJObPdwiQO9ndwTuRpS1BJEzAHpvjSqEC5\ngoF7d18I2IoikB9Qi+RKEUhIaEVwgsLZmTbKtCOBnCO+0lloh0M0FJTIeAfiIHSx\nSWTkBZ9eYXTJM0A17e6uV4GXEFnDQa2S/bJrA1mfMKK8Q0hMXYmB4ncydQKBgQCy\ne0zPa55H5y7ucT3EjYYu5ASJ5rnQmRMNPZAsrLb/vUXZiDWCYchAF3Jx1rZRGs6j\nj3fAAXOXNbptC7jFhsfYu7WOncYmx2OtemSTiK0DagLT2je+HnRay/qblNCg5tte\n0opB+j0di9MCtRz4KEA94DljtFwYX0fowRwDmkoCTQKBgHHM57saqfN8HdjW8HXR\n905BEIglCm9dJXlWhk6LGxRJJ5oXSlU2E6Rd/UvtqtGEawEVy2QgX/yUg+eaovr+\ngE/EsQQa9SgpaEj0iEHL5Ql3fqzZ3eu1h7UQCOA9/+JaX/uNcdxRglGjpNHs1Kvg\nu1dh7yLE6eLzT+r9BxZzR4tk\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@mysolomate.iam.gserviceaccount.com",
    "client_id": "102039127798146768096",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40mysolomate.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

// ✅ Hardcoded Firebase Web SDK Config
const firebaseConfig = {
    apiKey: "AIzaSyBRsxnaPdCcAcYmvj0JM9Spkz2-Gitiamg",
    authDomain: "mysolomate.firebaseapp.com",
    projectId: "mysolomate",
    storageBucket: "mysolomate.appspot.com",
    messagingSenderId: "347203906857",
    appId: "1:347203906857:web:c43736f211323eed66db38"
};

// 🔧 Initialize Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
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