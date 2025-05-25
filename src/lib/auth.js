import { auth } from './firebase';
import { browserLocalPersistence, setPersistence } from 'firebase/auth';

// Configure persistence
setPersistence(auth, browserLocalPersistence);

export async function setSessionCookie(user) {
    const token = await user.getIdToken();
    document.cookie = `session=${token}; path=/; Secure; SameSite=Strict`;
}

export async function clearSessionCookie() {
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}