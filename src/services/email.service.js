import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || undefined,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true",
  family: 4,
  service: process.env.SMTP_HOST ? undefined : "gmail",
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

const enviarEmail = async (opciones) => {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opciones.from || EMAIL_FROM,
        to: [opciones.to],
        subject: opciones.subject,
        html: opciones.html,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend respondió ${response.status}: ${detail}`);
    }
    return response.json();
  }

  const usuario = process.env.SMTP_USER || process.env.EMAIL_USER;
  const contrasena = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  if (!usuario || !contrasena) {
    throw new Error("Configuración de correo incompleta: define RESEND_API_KEY/RESEND_FROM o SMTP_USER/SMTP_PASS.");
  }

  return transporter.sendMail({
    from: opciones.from || `"Aroko" <${usuario}>`,
    ...opciones,
  });
};

const EMAIL_FROM = process.env.RESEND_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || "onboarding@resend.dev";

// ─── Paleta exacta de la página ────────────────────────────────────────────
// --accent:     #3BBEDA  (azul principal)
// --accent-d:   #2aa8c4  (azul oscuro)
// --chocolate:  #3D1C02
// --caramel:    #C47A2B
// --gold:       #F5C97A
// --cream:      #FDF8F0
// --bg-dark:    #100800  (footer)
// --muted:      #8B6F5E
// --font:       'Plus Jakarta Sans'

const BASE = {
  accent:     "#3BBEDA",
  accentD:    "#2aa8c4",
  chocolate:  "#3D1C02",
  caramel:    "#C47A2B",
  gold:       "#F5C97A",
  cream:      "#FDF8F0",
  bgDark:     "#100800",
  muted:      "#8B6F5E",
  success:    "#16a34a",
  danger:     "#e11d48",
  warning:    "#b45309",
};

// ─── Template base ──────────────────────────────────────────────────────────
const baseTemplate = ({ titulo, subtitulo = "", contenido, accentColor = BASE.accent }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${BASE.cream};font-family:'Plus Jakarta Sans',Arial,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BASE.cream};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;
               box-shadow:0 8px 40px rgba(61,28,2,0.10),0 2px 8px rgba(61,28,2,0.06);">

        <!-- ── Header ── -->
        <tr>
          <td style="background:${BASE.bgDark};padding:36px 48px;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <div style="display:inline-block;background:rgba(255,255,255,0.06);
                              border:1px solid rgba(255,255,255,0.10);
                              border-radius:16px;padding:14px 28px;">
                    <span style="font-family:'Plus Jakarta Sans',Arial,sans-serif;
                                 font-size:22px;font-weight:800;letter-spacing:0.08em;
                                 color:#ffffff;text-transform:uppercase;">
                      🥐 Aroko
                    </span>
                  </div>
                  <p style="margin:12px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                             font-size:12px;font-weight:600;letter-spacing:0.22em;
                             text-transform:uppercase;color:rgba(255,255,255,0.35);">
                    Panadería &amp; Pastelería Artesanal
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Banda de acento ── -->
        <tr>
          <td style="height:4px;background:linear-gradient(90deg,${accentColor},${BASE.caramel},${BASE.gold});"></td>
        </tr>

        <!-- ── Título ── -->
        <tr>
          <td style="padding:36px 48px 0;text-align:center;">
            <h1 style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                       font-size:24px;font-weight:800;color:${BASE.chocolate};
                       letter-spacing:-0.02em;line-height:1.2;">
              ${titulo}
            </h1>
            ${subtitulo
              ? `<p style="margin:8px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                           font-size:14px;font-weight:500;color:${BASE.muted};">${subtitulo}</p>`
              : ""}
          </td>
        </tr>

        <!-- ── Contenido ── -->
        <tr>
          <td style="padding:28px 48px 44px;">
            ${contenido}
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:${BASE.bgDark};padding:24px 48px;text-align:center;">
            <p style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                      font-size:12px;color:rgba(255,255,255,0.28);letter-spacing:0.01em;">
              © ${new Date().getFullYear()} Aroko · Panadería Artesanal
            </p>
            <p style="margin:6px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                      font-size:12px;color:rgba(255,255,255,0.22);">
              ¿Dudas? Escríbenos a
                <a href="mailto:${EMAIL_FROM}"
                  style="color:${BASE.accent};text-decoration:none;">${EMAIL_FROM}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ─── Helpers ────────────────────────────────────────────────────────────────
const badge = (texto, bg = BASE.accent) =>
  `<span style="display:inline-block;background:${bg};color:#fff;
               padding:3px 14px;border-radius:999px;font-family:'Plus Jakarta Sans',Arial,sans-serif;
               font-size:12px;font-weight:700;letter-spacing:0.04em;">${texto}</span>`;

const infoRow = (label, value) =>
  `<tr>
    <td style="padding:11px 0;border-bottom:1px solid rgba(61,28,2,0.07);
               font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
               color:${BASE.muted};width:42%;vertical-align:top;">${label}</td>
    <td style="padding:11px 0;border-bottom:1px solid rgba(61,28,2,0.07);
               font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
               color:${BASE.chocolate};font-weight:700;">${value}</td>
  </tr>`;

const infoTable = (rows) =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${rows}</table>`;

const callout = (texto, color = BASE.accent) =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background:rgba(59,190,218,0.07);border-left:3px solid ${color};
                 border-radius:0 12px 12px 0;padding:14px 18px;
                 font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
                 color:${BASE.chocolate};line-height:1.7;">
        ${texto}
      </td>
    </tr>
  </table>`;

const formatCOP = (v) =>
  Number(v).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });

// ─── 1. BIENVENIDA ──────────────────────────────────────────────────────────
export const enviarCorreoBienvenida = async ({ correo, nombre }) => {
  const contenido = `
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;
              font-weight:700;color:${BASE.chocolate};margin:0 0 6px;">
      ¡Hola, ${nombre}! 👋
    </p>
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;
              color:${BASE.muted};line-height:1.8;margin:0 0 24px;">
      Tu cuenta en <strong style="color:${BASE.chocolate};">Aroko</strong> ha sido creada exitosamente.
      Ya puedes explorar nuestro catálogo y hacer tus pedidos en línea.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:${BASE.cream};border-radius:16px;padding:24px;">
          <p style="margin:0 0 14px;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                    font-size:12px;font-weight:700;letter-spacing:0.18em;
                    text-transform:uppercase;color:${BASE.caramel};">
            ¿Qué puedes hacer ahora?
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              ["🛍️", "Explorar nuestro catálogo de panes y pasteles"],
              ["📦", "Realizar pedidos personalizados"],
              ["🛵", "Solicitar domicilios a tu puerta"],
              ["👤", "Gestionar tu perfil y direcciones"],
            ]
              .map(
                ([icon, text]) =>
                  `<tr><td style="padding:6px 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                                  font-size:13px;color:${BASE.chocolate};">
                    <span style="margin-right:10px;">${icon}</span>${text}
                  </td></tr>`
              )
              .join("")}
          </table>
        </td>
      </tr>
    </table>

    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
              color:${BASE.muted};line-height:1.8;margin:0;">
      Con amor y harina, el equipo de <strong style="color:${BASE.chocolate};">Aroko</strong> 🥐
    </p>
  `;

  await enviarEmail({
    from: `"Aroko" <${EMAIL_FROM}>`,
    to: correo,
    subject: `¡Bienvenido/a a Aroko, ${nombre}! 🥐`,
    html: baseTemplate({
      titulo: "¡Bienvenido/a a Aroko!",
      subtitulo: "Tu cuenta ha sido creada exitosamente",
      contenido,
      accentColor: BASE.accent,
    }),
  });
};

// ─── 2. PEDIDO EXITOSO ──────────────────────────────────────────────────────
export const enviarCorreoPedidoExitoso = async ({
  correo, nombre, numeroPedido, items = [], total, tipoPago, abonado,
}) => {
  const pendiente = total - (abonado ?? total);

  const itemsHTML = items.length
    ? `<table width="100%" cellpadding="0" cellspacing="0"
              style="margin:20px 0;border-collapse:collapse;">
        <thead>
          <tr style="background:${BASE.cream};">
            <th style="padding:10px 12px;text-align:left;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                       font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                       color:${BASE.muted};border-bottom:2px solid rgba(61,28,2,0.08);">Producto</th>
            <th style="padding:10px 12px;text-align:center;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                       font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                       color:${BASE.muted};border-bottom:2px solid rgba(61,28,2,0.08);">Cant.</th>
            <th style="padding:10px 12px;text-align:right;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                       font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                       color:${BASE.muted};border-bottom:2px solid rgba(61,28,2,0.08);">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (i) =>
                `<tr>
                  <td style="padding:10px 12px;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                             font-size:13px;color:${BASE.chocolate};
                             border-bottom:1px solid rgba(61,28,2,0.06);">${i.name ?? i.nombre}</td>
                  <td style="padding:10px 12px;text-align:center;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                             font-size:13px;color:${BASE.muted};
                             border-bottom:1px solid rgba(61,28,2,0.06);">${i.qty ?? i.cantidad}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                             font-size:13px;font-weight:600;color:${BASE.chocolate};
                             border-bottom:1px solid rgba(61,28,2,0.06);">${formatCOP(i.subtotal)}</td>
                </tr>`
            )
            .join("")}
          <tr style="background:${BASE.cream};">
            <td colspan="2" style="padding:12px;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                                   font-size:13px;font-weight:700;color:${BASE.chocolate};">Total</td>
            <td style="padding:12px;text-align:right;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                       font-size:15px;font-weight:800;color:${BASE.caramel};">${formatCOP(total)}</td>
          </tr>
        </tbody>
      </table>`
    : "";

  const contenido = `
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;
              font-weight:700;color:${BASE.chocolate};margin:0 0 6px;">
      ¡Hola, ${nombre}! Tu pedido fue recibido ✅
    </p>
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;
              color:${BASE.muted};line-height:1.8;margin:0 0 20px;">
      Estamos preparando todo con mucho cariño para ti.
    </p>

    ${infoTable(
      infoRow("Número de pedido", `<span style="color:${BASE.accent};font-weight:800;">${numeroPedido}</span>`) +
      infoRow("Tipo de pago", badge(
        tipoPago === "COMPLETO" ? "Pago completo" : "Abono parcial",
        tipoPago === "COMPLETO" ? BASE.success : BASE.caramel
      )) +
      (abonado != null ? infoRow("Abonado", `<span style="color:${BASE.success};">${formatCOP(abonado)}</span>`) : "") +
      (pendiente > 0 ? infoRow("Pendiente", `<span style="color:${BASE.danger};">${formatCOP(pendiente)}</span>`) : "")
    )}

    ${itemsHTML}

    ${callout("📦 Recibirás una notificación cuando tu pedido esté listo para entrega o domicilio.", BASE.accent)}

    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
              color:${BASE.muted};margin:0;">
      ¡Gracias por elegirnos! El equipo de <strong style="color:${BASE.chocolate};">Aroko</strong> 🥐
    </p>
  `;

  await enviarEmail({
    from: `"Aroko" <${EMAIL_FROM}>`,
    to: correo,
    subject: `Pedido ${numeroPedido} recibido — Aroko 🥐`,
    html: baseTemplate({
      titulo: "¡Pedido recibido!",
      subtitulo: `Pedido ${numeroPedido}`,
      contenido,
      accentColor: BASE.accent,
    }),
  });
};

// ─── 3. DOMICILIO CREADO ────────────────────────────────────────────────────
export const enviarCorreoDomicilioCreado = async ({
  correo, nombre, direccion, barrio, referencias,
}) => {
  const contenido = `
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;
              font-weight:700;color:${BASE.chocolate};margin:0 0 6px;">
      ¡Hola, ${nombre}! Tu domicilio fue registrado 🛵
    </p>
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;
              color:${BASE.muted};line-height:1.8;margin:0 0 20px;">
      Pronto uno de nuestros repartidores estará en camino.
    </p>

    ${infoTable(
      infoRow("Dirección", direccion) +
      infoRow("Barrio", barrio) +
      (referencias ? infoRow("Referencias", referencias) : "") +
      infoRow("Estado", badge("PENDIENTE", BASE.caramel))
    )}

    ${callout(
      `🔔 Te notificaremos cuando el domicilio esté <strong>en camino</strong> y cuando sea <strong>entregado</strong>.`,
      BASE.accent
    )}

    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
              color:${BASE.muted};margin:0;">
      ¡Gracias por tu pedido! El equipo de <strong style="color:${BASE.chocolate};">Aroko</strong> 🥐
    </p>
  `;

  await enviarEmail({
    from: `"Aroko" <${EMAIL_FROM}>`,
    to: correo,
    subject: `Tu domicilio está registrado — Aroko 🛵`,
    html: baseTemplate({
      titulo: "¡Domicilio registrado!",
      subtitulo: "Tu pedido llegará pronto a tu puerta",
      contenido,
      accentColor: BASE.accent,
    }),
  });
};

// ─── 7. CREDENCIALES TEMPORALES ─────────────────────────────────────────────
export const enviarCorreoCredenciales = async ({ correo, nombre, contrasena, esEmpleado = false }) => {
  const contenido = `
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;
              font-weight:700;color:${BASE.chocolate};margin:0 0 6px;">
      ¡Hola, ${nombre}! 🔑
    </p>
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;
              color:${BASE.muted};line-height:1.8;margin:0 0 20px;">
      ${esEmpleado ? 'Tu cuenta de empleado ha sido creada.' : 'Tu cuenta ha sido creada.'}
      Estas son tus credenciales temporales de acceso.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:${BASE.cream};border-radius:16px;padding:24px;">
          <p style="margin:0 0 14px;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                    font-size:12px;font-weight:700;letter-spacing:0.18em;
                    text-transform:uppercase;color:${BASE.caramel};">
            Credenciales de acceso
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                         font-size:13px;color:${BASE.muted};">📧 Correo</td>
              <td style="padding:8px 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                         font-size:13px;color:${BASE.chocolate};font-weight:700;text-align:right;">
                ${correo}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                         font-size:13px;color:${BASE.muted};">🔐 Contraseña temporal</td>
              <td style="padding:8px 0;font-family:'Courier New',monospace;
                         font-size:15px;color:${BASE.chocolate};font-weight:800;
                         text-align:right;letter-spacing:2px;background:rgba(59,190,218,0.10);
                         border-radius:6px;padding:6px 10px;">
                ${contrasena}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:rgba(225,29,72,0.06);border:1px solid rgba(225,29,72,0.15);
                   border-radius:12px;padding:14px 18px;
                   font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
                   color:${BASE.warning};line-height:1.7;">
          ⚠️ Por seguridad, cambia tu contraseña temporal inmediatamente después de iniciar sesión.
        </td>
      </tr>
    </table>

    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
              color:${BASE.muted};line-height:1.8;margin:0;">
      El equipo de <strong style="color:${BASE.chocolate};">Aroko</strong> 🥐
    </p>
  `;

  await enviarEmail({
    from: `"Aroko" <${EMAIL_FROM}>`,
    to: correo,
    subject: `Tus credenciales de acceso — Aroko 🔑`,
    html: baseTemplate({
      titulo: "Credenciales de acceso",
      subtitulo: "Información confidencial",
      contenido,
      accentColor: BASE.accent,
    }),
  });
};

// ─── 4. DOMICILIO ENTREGADO ─────────────────────────────────────────────────
export const enviarCorreoEntrega = async ({ correo, nombre }) => {
  const contenido = `
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;
              font-weight:700;color:${BASE.chocolate};margin:0 0 6px;">
      ¡Hola, ${nombre}! Tu pedido fue entregado 🎉
    </p>
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;
              color:${BASE.muted};line-height:1.8;margin:0 0 24px;">
      Esperamos que disfrutes cada bocado de nuestros productos artesanales.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td align="center" style="background:${BASE.cream};border-radius:16px;padding:32px 24px;">
          <div style="width:64px;height:64px;border-radius:50%;
                      background:rgba(22,163,74,0.10);
                      display:inline-flex;align-items:center;justify-content:center;
                      font-size:28px;margin-bottom:12px;">✅</div>
          <p style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                    font-size:16px;font-weight:800;color:${BASE.success};">
            Entrega confirmada
          </p>
          <p style="margin:6px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                    font-size:13px;color:${BASE.muted};">
            Tu domicilio fue entregado exitosamente
          </p>
        </td>
      </tr>
    </table>

    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
              color:${BASE.muted};line-height:1.8;margin:0;">
      Si tienes algún comentario sobre tu experiencia, no dudes en escribirnos.
      ¡Gracias por confiar en <strong style="color:${BASE.chocolate};">Aroko</strong>! 🥐
    </p>
  `;

  await enviarEmail({
    from: `"Aroko" <${EMAIL_FROM}>`,
    to: correo,
    subject: `¡Tu pedido fue entregado! — Aroko ✅`,
    html: baseTemplate({
      titulo: "¡Pedido entregado!",
      subtitulo: "Gracias por elegir Aroko",
      contenido,
      accentColor: BASE.success,
    }),
  });
};

// ─── 5. FECHA DE ENTREGA (pedidos mayoristas) ───────────────────────────────
export const enviarCorreoFechaEntrega = async ({ correo, nombre, fechaEntrega, numeroPedido }) => {
  const fecha = new Date(fechaEntrega).toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const contenido = `
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;
              font-weight:700;color:${BASE.chocolate};margin:0 0 6px;">
      ¡Hola, ${nombre}! Tu pedido tiene fecha de entrega 📅
    </p>
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;
              color:${BASE.muted};line-height:1.8;margin:0 0 20px;">
      Ya tenemos todo listo para hacerte llegar tu pedido.
    </p>

    ${infoTable(
      infoRow("Número de pedido", `<span style="color:${BASE.accent};font-weight:800;">${numeroPedido}</span>`) +
      infoRow("Fecha de entrega", `<strong style="color:${BASE.caramel};">${fecha}</strong>`)
    )}

    ${callout("📦 Si tienes alguna duda sobre tu pedido, no dudes en contactarnos.", BASE.caramel)}

    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
              color:${BASE.muted};margin:0;">
      ¡Gracias por confiar en nosotros! El equipo de <strong style="color:${BASE.chocolate};">Aroko</strong> 🥐
    </p>
  `;

  await enviarEmail({
    from: `"Aroko" <${EMAIL_FROM}>`,
    to: correo,
    subject: `Fecha de entrega asignada — Pedido ${numeroPedido} 📅`,
    html: baseTemplate({
      titulo: "Fecha de entrega asignada",
      subtitulo: `Pedido ${numeroPedido}`,
      contenido,
      accentColor: BASE.caramel,
    }),
  });
};

// ─── UTILIDAD: Generar contraseña aleatoria ─────────────────────────────────
export const generarContrasena = (longitud = 10) => {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const especiales = '!@#$%&*';
  const todos = mayusculas + minusculas + numeros + especiales;

  let contrasena = '';
  contrasena += mayusculas[Math.floor(Math.random() * mayusculas.length)];
  contrasena += minusculas[Math.floor(Math.random() * minusculas.length)];
  contrasena += numeros[Math.floor(Math.random() * numeros.length)];
  contrasena += especiales[Math.floor(Math.random() * especiales.length)];

  for (let i = 4; i < longitud; i++) {
    contrasena += todos[Math.floor(Math.random() * todos.length)];
  }

  return contrasena
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

// ─── 6. RECUPERAR CONTRASEÑA ────────────────────────────────────────────────
export const enviarCorreoRecuperacion = async ({ correo, codigo }) => {
  const contenido = `
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:16px;
              font-weight:700;color:${BASE.chocolate};margin:0 0 6px;">
      Recupera tu contraseña 🔐
    </p>
    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;
              color:${BASE.muted};line-height:1.8;margin:0 0 28px;">
      Recibimos una solicitud para restablecer tu contraseña.
      Usa el siguiente código. <strong style="color:${BASE.chocolate};">Expira en 15 minutos.</strong>
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:${BASE.bgDark};border-radius:20px;padding:32px 48px;text-align:center;">
                <p style="margin:0 0 10px;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                           font-size:11px;font-weight:700;letter-spacing:0.28em;
                           text-transform:uppercase;color:rgba(255,255,255,0.35);">
                  Código de verificación
                </p>
                <p style="margin:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                           font-size:44px;font-weight:800;letter-spacing:12px;
                           color:#ffffff;line-height:1;">
                  ${codigo}
                </p>
                <p style="margin:12px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;
                           font-size:11px;color:rgba(255,255,255,0.28);">
                  Válido por 15 minutos
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:rgba(245,201,122,0.12);border:1px solid rgba(196,122,43,0.20);
                   border-radius:12px;padding:14px 18px;
                   font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;
                   color:${BASE.warning};line-height:1.7;">
          ⚠️ Si no solicitaste este código, ignora este correo. Tu contraseña no será cambiada.
        </td>
      </tr>
    </table>

    <p style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;
              color:rgba(139,111,94,0.6);margin:0;">
      Por seguridad, nunca compartas este código con nadie.
    </p>
  `;

  await enviarEmail({
    from: `"Aroko" <${EMAIL_FROM}>`,
    to: correo,
    subject: `Código de recuperación — Aroko 🔐`,
    html: baseTemplate({
      titulo: "Recuperar contraseña",
      subtitulo: "Ingresa el código en la aplicación",
      contenido,
      accentColor: BASE.accent,
    }),
  });
};
