import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteReminder, resolveReminder } from "@/lib/reminders";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const resolved = typeof body?.resolved === "boolean" ? body.resolved : true;

    const updated = await resolveReminder(id, resolved);
    return NextResponse.json({ reminder: updated });
  } catch (error) {
    console.error("[reminders PATCH] failed:", error);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await deleteReminder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[reminders DELETE] failed:", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}


