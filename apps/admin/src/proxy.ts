import { NextResponse, type NextRequest } from "next/server";

const entry = process.env.GOL_DE_OURO_ENTRY;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (entry === "dashboard" && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
