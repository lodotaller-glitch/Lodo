// /api/auth/logout/route.js (o donde lo tengas)
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { User } from "@/models";

export async function POST(req) {
  await dbConnect();
  const token = req.cookies.get("refreshToken")?.value;

  if (token) {
    // invalida solo este refresh
    await User.updateOne(
      { refreshTokens: token },
      { $pull: { refreshTokens: token } }
    ).catch(() => {});
    await User.updateOne(
      { refreshToken: token },
      { $unset: { refreshToken: "" } }
    ).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set("refreshToken", "", { maxAge: 0, path: "/" });
  res.cookies.set("accessToken", "", { maxAge: 0, path: "/" });
  res.cookies.set("role", "", { maxAge: 0, path: "/" });

  return res;
}
