import { verifyAccessToken } from "@/lib/auth";
import { User } from "@/models";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";

export async function getUserFromRequest(req) {
  // 1) Authorization: Bearer <token>
  const auth =
    req.headers?.get?.("authorization") || req.headers?.get?.("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (token) {
    try {
      // Tu verifyAccessToken viene de src/lib/auth.js (jsonwebtoken)
      const payload = verifyAccessToken(token);
      // En tu código firmás tokens a veces con { id } y otras con { sub, ...publicUser }
      const id = payload?.id || payload?.sub || payload?.userId || payload?._id;

      let userDoc = null;
      if (id && Types.ObjectId.isValid(String(id))) {
        userDoc = await User.findById(id).lean();
      }

      if (userDoc) {
        return {
          id: String(userDoc._id),
          role: userDoc.role,
          email: userDoc.email,
          name: userDoc.name,
          state: userDoc.state,
          capacity: userDoc.capacity,
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
    };
  }

  // 3) No autenticado
  return null;
}

// const secretKey = process?.env?.SECRET_KEY;

// // --- helpers ---------------------------------------------------------------
// function normalizeRole(r) {
//   return String(r ?? "")
//     .trim()
//     .toLowerCase();
// }

// function parseCookieHeader(cookieHeader, name) {
//   if (!cookieHeader) return null;
//   const parts = cookieHeader.split(";").map((s) => s.trim());
//   const hit = parts.find((p) => p.startsWith(`${name}=`));
//   return hit ? hit.split("=").slice(1).join("=") : null;
// }

// function getCookieValue(req, name = "user") {
//   try {
//     // NextRequest (App Router / Middleware)
//     const c = req?.cookies?.get?.(name);
//     if (!c) {
//       // Fallback a header Cookie (cuando req es Request estándar)
//       const cookieHeader =
//         req?.headers?.get?.("cookie") || req?.headers?.get?.("Cookie");
//       return parseCookieHeader(cookieHeader, name);
//     }
//     // Puede venir como string o como { name, value }
//     return typeof c === "string" ? c : c?.value ?? null;
//   } catch {
//     const cookieHeader =
//       req?.headers?.get?.("cookie") || req?.headers?.get?.("Cookie");
//     return parseCookieHeader(cookieHeader, name);
//   }
// }

// function decodeTokenFromReq(req, cookieName = "user") {
//   if (!secretKey) return null;
//   const token = getCookieValue(req, cookieName);
//   if (!token) return null;
//   try {
//     return jwt.verify(token, secretKey); // devuelve payload
//   } catch {
//     return null;
//   }
// }

// function roleFromPayload(payload) {
//   return (
//     payload?.typeUser ?? // tu campo más usado
//     payload?.role ??
//     payload?.user?.role ??
//     null
//   );
// }

// // Permite mapear sinónimos/variaciones de roles
// const ROLE_ALIASES = {
//   admin: ["admin"],
//   networks: ["networks", "network", "net"],
//   teacher: ["teacher", "profesor", "professor", "docente"],
//   satelite: ["satelite", "satellite"],
//   empleado: ["empleado", "employee"],
//   facturador: ["facturador", "billing"],
// };

// function isOneOf(role, allowed = []) {
//   const r = normalizeRole(role);
//   const expanded = allowed.flatMap(
//     (x) => ROLE_ALIASES[normalizeRole(x)] ?? [normalizeRole(x)]
//   );
//   return expanded.includes(r);
// }

// // --- API pública -----------------------------------------------------------
// /**
//  * Devuelve info básica del usuario a partir del JWT en cookie `user`.
//  * { id, role, email?, name?, raw? } | null
//  */
// export function getUserFromRequest(req) {
//   const payload = decodeTokenFromReq(req, "user");
//   if (!payload) return null;

//   const id =
//     payload?.id || payload?.sub || payload?.userId || payload?._id || null;
//   const role = roleFromPayload(payload);

//   return {
//     id: id ? String(id) : null,
//     role: normalizeRole(role),
//     email: payload?.email ?? payload?.user?.email ?? null,
//     name: payload?.name ?? payload?.user?.name ?? null,
//     raw: payload,
//   };
// }

// /** Acceso tipo "admin" (o "networks"), con opción `noNet` para exigir sólo admin. */
// export function accesAdmin(req, noNet = false) {
//   try {
//     const u = getUserFromRequest(req);
//     if (!u) return false;
//     if (noNet) return isOneOf(u.role, ["admin"]);
//     return isOneOf(u.role, ["admin", "networks"]);
//   } catch {
//     return false;
//   }
// }

// /** Acceso tipo empleados: admin | teacher | networks */
// export function accesEmployee(req) {
//   try {
//     const u = getUserFromRequest(req);
//     if (!u) return false;
//     return isOneOf(u.role, ["admin", "teacher", "networks"]);
//   } catch {
//     return false;
//   }
// }

// /** Acceso satélite: admin | satelite */
// export function accesSatelite(req) {
//   try {
//     const u = getUserFromRequest(req);
//     if (!u) return false;
//     return isOneOf(u.role, ["admin", "satelite"]);
//   } catch {
//     return false;
//   }
// }

// /** Acceso amplio: admin | satelite | empleado | facturador */
// export function accesAll(req) {
//   try {
//     const u = getUserFromRequest(req);
//     if (!u) return false;
//     return isOneOf(u.role, ["admin", "satelite", "empleado", "facturador"]);
//   } catch {
//     return false;
//   }
// }

// // Helpers opcionales para lanzar 401/403 si querés cortar la request
// export function requireAcces(checkFn, req) {
//   const ok = checkFn(req);
//   if (!ok) {
//     const err = new Error("No autorizado");
//     err.status = 403;
//     throw err;
//   }
// }

// export function requireRole(req, roles = []) {
//   const u = getUserFromRequest(req);
//   if (!u) {
//     const err = new Error("No autenticado");
//     err.status = 401;
//     throw err;
//   }
//   if (!isOneOf(u.role, roles)) {
//     const err = new Error("No autorizado");
//     err.status = 403;
//     throw err;
//   }
//   return u;
// }
