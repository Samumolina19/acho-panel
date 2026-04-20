import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");

  const USER = process.env.BASIC_USER || "admin";
  const PASS = process.env.BASIC_PASS || "cambia_esto_ya";

  if (auth) {
    const base64 = auth.split(" ")[1];
    const [user, pass] = atob(base64).split(":");

    if (user === USER && pass === PASS) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Auth required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Zona privada"',
    },
  });
}

export const config = {
  matcher: "/:path*",
};