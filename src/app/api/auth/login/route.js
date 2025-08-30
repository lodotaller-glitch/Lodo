import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function POST(req) {
  await dbConnect();
  const { email, password } = await req.json();

  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    return NextResponse.json(
      { error: "Credenciales inválidas" },
      { status: 401 }
    );
  }

  const accessToken = signAccessToken({ id: user._id });
  const refreshToken = signRefreshToken({ id: user._id });
  user.refreshToken = refreshToken;
  await user.save();

  const res = NextResponse.json({
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
    },
  });
  res.cookies.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
