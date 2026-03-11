import { db } from './firebase-admin';

export async function isSystemLocked(): Promise<boolean> {
    try {
        const doc = await db.collection('settings').doc('lock').get();
        if (!doc.exists) {
            // If the document doesn't exist, we assume it's unlocked for development
            // or we could force it to locked. Let's force it to locked for security.
            return true;
        }
        const data = doc.data();
        return data?.isLocked === true;
    } catch (error) {
        console.error('Check lock status error:', error);
        // Fail-safe: assume locked if DB error
        return true;
    }
}
