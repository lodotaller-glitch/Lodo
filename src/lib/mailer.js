import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.GMAIL_USER,
//     pass: process.env.GMAIL_APP_PASSWORD,
//   },
// });

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,          // STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.M365_GMAIL,      // p.ej. administracion@lodoceramica.com
    pass: process.env.M365_PASSWORD,
  },
});

// --- helpers de marca / entorno ---
const BRAND = { main: "#A08775", soft: "#DDD7C9", text: "#1F1C19" };
const APP_URL =
  process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
const APP_BASE = APP_URL.replace(/\/+$/, ""); // sin slash final

const HEADER_BG_URL =
  "https://res.cloudinary.com/dx3mjnxhn/image/upload/v1758501927/sbwofxhljuqxfcywwtzl.png";
const LOGO_URL =
  "https://res.cloudinary.com/dx3mjnxhn/image/upload/v1758501926/eovygh8ibnshtf3zryqt.png";

// Wrapper base para todos los emails
function emailBase({
  preheader = "",
  heading = "",
  contentHtml = "",
  ctaLabel,
  ctaHref,
}) {
  const btn =
    ctaLabel && ctaHref
      ? `<tr><td style="padding-top: 12px;">
           <a href="${ctaHref}" target="_blank"
              style="display:inline-block;background:${BRAND.main};color:#fff;text-decoration:none;
                     padding:12px 18px;border-radius:12px;font-weight:700;">
             ${ctaLabel}
           </a>
         </td></tr>`
      : "";

  return `
<!-- Preheader (oculto) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
       style="background:${BRAND.soft};margin:0;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
             style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;
                    font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${
                      BRAND.text
                    }">
        <!-- Header -->
        <tr>
           <td align="left" style="vertical-align:middle; background:${
             BRAND.main
           } url('${HEADER_BG_URL}') center/cover no-repeat;
      color:#fff;padding:16px 24px;
      font-weight:800;font-size:18px;letter-spacing:.2px;
      height:96px;">
          <img
            src="${LOGO_URL}"
            width="36" height="36" alt="Logo"
            style="display:inline-block;border:0;outline:none;text-decoration:none;border-radius:8px;margin-right:8px;vertical-align:middle;"
          />
          <span style="vertical-align:middle;">Taller de Cerámica LODO</span>
        </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px">
            ${
              heading
                ? `<h1 style="margin:0 0 8px 0;font-size:22px;line-height:28px;color:${BRAND.text};">${heading}</h1>`
                : ""
            }
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="font-size:15px;line-height:22px;color:${
                BRAND.text
              }">${contentHtml}</td></tr>
              ${btn}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
       <td style="padding:14px 24px;border-top:1px solid #eee;font-size:12px;color:${
         BRAND.text
       }B3;">
  Este es un mensaje automático del Taller. Si no corresponde, ignoralo.
  ${
    APP_BASE
      ? ` · <a href="${APP_BASE}" target="_blank" style="color:${BRAND.main};text-decoration:none;">Ir al Taller</a>`
      : ""
  }
</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
}

function toPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendPieceReadyEmail(to, { studentName, pieceTitle }) {
  const subject = `Tu pieza "${pieceTitle}" ya está lista`;
  const contentHtml = `
    <p style="margin:0 0 10px 0;">Hola ${studentName || ""},</p>
    <p style="margin:0 0 10px 0;">
      ¡Buenas noticias! Tu pieza <strong>${pieceTitle}</strong> está <strong>lista</strong> para retirar.
    </p>
    <p style="margin:0 0 10px 0;">Podés pasar por el taller en tu horario habitual.</p>
    <p style="margin:0 0 0 0;"><strong>Importante:</strong> tenés <strong>30 días</strong> a partir de este aviso para retirarla.</p>
    <p style="margin:16px 0 0 0;">— Equipo Lodo Cerámica</p>
  `;
  const html = emailBase({
    preheader: `Tu pieza "${pieceTitle}" está lista para retirar (30 días para retirarla)`,
    heading: "¡Tu pieza está lista!",
    contentHtml,
    ctaLabel: APP_BASE ? "Ingresar al Taller" : undefined,
    ctaHref: APP_BASE ? `${APP_BASE}/login` : undefined,
  });

  await transporter.sendMail({
    from: `Taller <${process.env.M365_GMAIL}>`,
    to,
    subject,
    html,
    text: toPlainText(contentHtml),
  });
}

export async function sendNewAccountEmail(
  to,
  {
    studentName,
    email,
    tempPassword, // opcional
    professorName, // opcional
    weekdayLabel, // opcional
    timeRangeLabel, // opcional
    year,
    month, // opcional
  }
) {
  const subject = "Tu cuenta del Taller fue creada";

  const slotInfo =
    professorName && weekdayLabel && timeRangeLabel
      ? `<p style="margin:0 0 10px 0;">
           Te asignamos una clase semanal con <strong>${professorName}</strong>
           los <strong>${weekdayLabel}</strong> de <strong>${timeRangeLabel}</strong>
           ${
             month && year ? ` (${String(month).padStart(2, "0")}/${year})` : ""
           }.
         </p>`
      : "";

  const passInfo = tempPassword
    ? `<p style="margin:0 0 10px 0;">
         Podés ingresar con:<br/>
         Usuario: <strong>${email}</strong><br/>
         Contraseña temporal: <strong>${tempPassword}</strong>
       </p>`
    : `<p style="margin:0 0 10px 0;">
         Podés ingresar con tu usuario: <strong>${email}</strong>.
         Si no recordás tu contraseña, usá <em>“Olvidé mi contraseña”</em>.
       </p>`;

  const contentHtml = `
    <p style="margin:0 0 10px 0;">Hola ${studentName || ""},</p>
    <p style="margin:0 0 10px 0;">¡Bienvenido/a! Ya tenés tu cuenta activa en el Taller.</p>
    ${passInfo}
    ${slotInfo}
    <p style="margin:16px 0 0 0;">— Equipo Lodo Cerámica</p>
  `;

  console.log("sendNewAccountEmail to:", to, "with temp pass:", tempPassword);
  console.log(process.env.M365_GMAIL, process.env.M365_PASSWORD, "passInfo");
  

  const html = emailBase({
    preheader: "Tu cuenta del Taller Lodo Cerámica ya está activa",
    heading: "¡Cuenta creada con éxito!",
    contentHtml,
    ctaLabel: APP_BASE ? "Ingresar al Taller" : undefined,
    ctaHref: APP_BASE ? `${APP_BASE}/login` : undefined,
  });

  await transporter.sendMail({
    from: `Taller <${process.env.M365_GMAIL}>`,
    to,
    subject,
    html,
    text: toPlainText(contentHtml),
  });
}
