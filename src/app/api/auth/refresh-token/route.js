import { signAccessToken, verifyRefreshToken } from "@/lib/auth";
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
  const publicUser = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    state: user.state,
    branch: user.branch,
    capacity: user.capacity,
  };

  // Mete los datos en el JWT (claims)
  const accessToken = signAccessToken({
    sub: publicUser.id, // estándar JWT
    ...publicUser, // name, email, role, state, capacity
  });

  // Opcional y práctico: devolver también el usuario junto al token
  return NextResponse.json({ accessToken, user: publicUser });
}
