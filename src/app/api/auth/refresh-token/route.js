import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { User } from "@/models";

export async function POST(req) {
  await dbConnect();
  const token = req.cookies.get("refreshToken")?.value;
  if (!token) return NextResponse.json({ error: "Sin token" }, { status: 401 });

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const user = await User.findById(payload.id);
  if (!user || user.refreshToken !== token) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Campos públicos que te sirven luego (no incluir nada sensible)
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
