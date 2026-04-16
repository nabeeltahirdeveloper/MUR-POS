import { prisma } from './prisma';

export async function isSystemLocked(): Promise<boolean> {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'lock' },
        });
        if (!setting) {
            // If the setting doesn't exist, assume locked for security
            return true;
        }
        const data = JSON.parse(setting.value);
        return data?.isLocked === true;
    } catch (error) {
        console.error('Check lock status error:', error);
        // Fail-safe: assume locked if DB error
        return true;
    }
}
