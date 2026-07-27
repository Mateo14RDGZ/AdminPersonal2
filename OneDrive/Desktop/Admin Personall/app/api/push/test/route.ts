import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { sendPushToUser } from "@/lib/push-server";

export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;

  const result = await sendPushToUser(user.id, {
    title: "La Pesadilla Finanzas",
    body: "Las notificaciones funcionan correctamente.",
    url: "/inicio",
  });
  if (!result.configured) return NextResponse.json({ error: "Las notificaciones no estan configuradas en el servidor." }, { status: 503 });
  if (result.sent === 0) return NextResponse.json({ error: "No hay un dispositivo suscripto para recibir la prueba." }, { status: 409 });
  return NextResponse.json({ ok: true, message: "Notificacion de prueba enviada." });
}
