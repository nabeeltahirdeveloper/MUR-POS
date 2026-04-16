import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all reminders
export async function GET() {
    try {
        const reminders = await prisma.reminder.findMany({
            orderBy: { createdAt: 'desc' },
        });

        // Separate by status
        const pending = reminders.filter(r => !r.triggered);
        const triggered = reminders.filter(r => r.triggered);

        return NextResponse.json({
            success: true,
            data: {
                all: reminders,
                pending,
                triggered,
                summary: {
                    total: reminders.length,
                    pendingCount: pending.length,
                    triggeredCount: triggered.length,
                },
            },
        });
    } catch (error) {
        console.error('Error fetching reminders:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch reminders' },
            { status: 500 }
        );
    }
}

// POST - Create a new reminder
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, referenceId, message } = body;

        if (!type) {
            return NextResponse.json(
                { success: false, error: 'type is required' },
                { status: 400 }
            );
        }

        const validTypes = ['low_stock', 'bill_due', 'debt_due'];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { success: false, error: `Type must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            );
        }

        const id = `${type}:${referenceId || 'test'}_${Date.now()}`;
        const reminder = await prisma.reminder.create({
            data: {
                id,
                type,
                referenceId: referenceId || null,
                message,
                triggered: false,
            },
        });

        return NextResponse.json({
            success: true,
            data: reminder,
        });
    } catch (error) {
        console.error('Error creating reminder:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create reminder' },
            { status: 500 }
        );
    }
}

// PATCH - Mark reminder as triggered
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, triggered } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'id is required' },
                { status: 400 }
            );
        }

        const reminder = await prisma.reminder.update({
            where: { id },
            data: { triggered: triggered ?? true },
        });

        return NextResponse.json({
            success: true,
            data: reminder,
        });
    } catch (error) {
        console.error('Error updating reminder:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update reminder' },
            { status: 500 }
        );
    }
}
