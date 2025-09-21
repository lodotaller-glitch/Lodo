// import { jwtVerify } from "jose";

// const ACCESS_SECRET = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET);

// export async function verifyAccessOnEdge(token) {
//   try {
//     const { payload } = await jwtVerify(token, ACCESS_SECRET);
    
//     return payload; // { role, sub, exp, ... }
//   } catch {
//     return null; // inválido o expirado
//   }
// }


// lib/edgeAuth.js
import { jwtVerify } from "jose";

// Debe ser la CLAVE del ACCESS token
const ACCESS_SECRET = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);

export async function verifyAccessOnEdge(token) {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return payload; // { role, sub, exp, ... }
  } catch {
    return null;
  }
}