import { NextRequest, NextResponse } from "next/server";
import { authenticateAutomationToken } from "@/lib/automation-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authenticateAutomationToken(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Token inválido" }, { status: 401 });
  }
  if (!checkRateLimit(rateLimitKey(request, auth.tokenId))) {
    return NextResponse.json({ success: false, message: "Demasiadas solicitudes" }, { status: 429 });
  }
  return NextResponse.json({
    success: true,
    message: "Conexión correcta con LaPesadilla Finanzas",
  });
}

export const POST = GET;

