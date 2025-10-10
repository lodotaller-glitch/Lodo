import { verifyAccessToken, verifyRefreshToken } from "@/lib/auth";
import { Branch, User } from "@/models";
import { Types } from "mongoose";

export async function getUserFromRequest(req) {
  // 1) Authorization: Bearer <token>
  //   const auth =
  //     req.headers.cookie?.get?.("authorization") || req.headers?.get?.("refreshToken");
  //   const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  // const cookieToken =
  //     req.cookies?.get?.("accessToken")?.value ||
  //     req.cookies?.get?.("refreshToken")?.value;
  const token = req.cookies?.get?.("refreshToken")?.value;

  if (token) {
    try {
      // Tu verifyAccessToken viene de src/lib/auth.js (jsonwebtoken)
      const payload = verifyRefreshToken(token);

      // En tu código firmás tokens a veces con { id } y otras con { sub, ...publicUser }
      const id = payload?.id || payload?.sub || payload?.userId || payload?._id;

      let userDoc = null;
      if (id && Types.ObjectId.isValid(String(id))) {
        userDoc = await User.findById(id).lean();
      }

      if (userDoc) {
        return {
          _id: String(userDoc._id),
          role: userDoc.role,
          email: userDoc.email,
          name: userDoc.name,
          state: userDoc.state,
          capacity: userDoc.capacity,
          branch: userDoc.branch,
        };
      }

      // Si el token es válido pero no encontramos el user (poco común),
      // devolvemos lo mínimo desde el token para no reventar la request.
      if (id) {
        return {
          id: String(id),
          role: payload?.role ?? payload?.user?.role ?? "student", // valor por defecto
          email: payload?.email ?? payload?.user?.email ?? null,
          name: payload?.name ?? payload?.user?.name ?? null,
          state: payload?.state ?? null,
          capacity: payload?.capacity ?? null,
          branch: payload?.branch ?? null,
        };
      }
    } catch {
      // token inválido/expirado -> seguimos a fallback dev o null
    }
  }

  // 2) Fallback de desarrollo: headers manuales
  const devId =
    req.headers?.get?.("x-user-id") || req.headers?.get?.("X-User-Id");
  const devRole =
    req.headers?.get?.("x-user-role") || req.headers?.get?.("X-User-Role");

  if (devId) {
    let userDoc = null;
    if (Types.ObjectId.isValid(String(devId))) {
      userDoc = await User.findById(devId).lean();
    } else {
      userDoc = await User.findOne({ email: devId }).lean();
    }
    return {
      id: userDoc ? String(userDoc._id) : String(devId),
      role: userDoc?.role || devRole || "student",
      email: userDoc?.email || null,
      name: userDoc?.name || null,
      state: userDoc?.state || null,
      capacity: userDoc?.capacity || null,
      branch: userDoc?.branch || null,
    };
  }

  // 3) No autenticado
  return null;
}

// --- helpers ---------------------------------------------------------------
function normalizeRole(r) {
  return String(r ?? "")
    .trim()
    .toLowerCase();
}

// Permite mapear sinónimos/variaciones de roles
const ROLE_ALIASES = {
  admin: ["admin"],
  networks: ["networks", "network", "net"],
  teacher: ["teacher", "profesor", "professor", "docente"],
  satelite: ["satelite", "satellite"],
  empleado: ["empleado", "employee"],
  facturador: ["facturador", "billing"],
};

function isOneOf(role, allowed = []) {
  const r = normalizeRole(role);
  const expanded = allowed.flatMap(
    (x) => ROLE_ALIASES[normalizeRole(x)] ?? [normalizeRole(x)]
  );
  return expanded.includes(r);
}

/** Acceso tipo "admin" (o "networks"), con opción `noNet` para exigir sólo admin. */
export async function accesAdmin(req, noNet = false) {
  try {
    const u = await getUserFromRequest(req);
    if (!u) return false;
    if (noNet) return isOneOf(u.role, ["admin"]);
    return isOneOf(u.role, ["admin", "networks"]);
  } catch {
    return false;
  }
}

/** Acceso tipo empleados: admin | teacher | networks */
export async function accesEmployee(req) {
  try {
    const u = await getUserFromRequest(req);
    if (!u) return false;
    return isOneOf(u.role, ["admin", "teacher", "networks"]);
  } catch {
    return false;
  }
}

/** Acceso satélite: admin | satelite */
export async function accesSatelite(req) {
  try {
    const u = await getUserFromRequest(req);
    if (!u) return false;
    return isOneOf(u.role, ["admin", "satelite"]);
  } catch {
    return false;
  }
}

/** Acceso amplio: admin | satelite | empleado | facturador */
export async function accesAll(req) {
  try {
    const u = await getUserFromRequest(req);
    if (!u) return false;
    return isOneOf(u.role, ["admin", "satelite", "empleado", "facturador"]);
  } catch {
    return false;
  }
}

// Helpers opcionales para lanzar 401/403 si querés cortar la request
export async function requireAcces(checkFn, req) {
  const ok = checkFn(req);
  if (!ok) {
    const err = new Error("No autorizado");
    err.status = 403;
    throw err;
  }
}

export async function requireRole(req, roles = []) {
  const u = await getUserFromRequest(req);
  if (!u) {
    const err = new Error("No autenticado");
    err.status = 401;
    throw err;
  }
  if (!isOneOf(u.role, roles)) {
    const err = new Error("No autorizado");
    err.status = 403;
    throw err;
  }
  return u;
}
