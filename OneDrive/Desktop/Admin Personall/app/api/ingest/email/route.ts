import { NextRequest } from "next/server";
import { handleIngest } from "@/lib/ingest";

export async function POST(request: NextRequest) {
  return handleIngest(request, "email");
}
