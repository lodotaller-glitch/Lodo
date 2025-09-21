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

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    state: user.state,
    branch: user.branch,
    capacity: user.capacity,
    clayKg: user.clayKg ?? 0,
  });

  const refreshToken = signRefreshToken({ id: user._id, role: user.role });
  // Guarda refresh (o al array de refreshTokens si permites múltiples sesiones)
  user.refreshToken = refreshToken;
  await user.save();

  const res = NextResponse.json({
    accessToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
      clayKg: user.clayKg ?? 0,
    },
  });

  // Refresh: httpOnly
  res.cookies.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  // Access: httpOnly (el middleware puede leerlo igualmente)
  res.cookies.set("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 7, // 15 minutos, por ejemplo
  });

  // (Opcional) Cookie 'role' legible por el navegador, solo para routing
  res.cookies.set("role", user.role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
