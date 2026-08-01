/**
 * Manda a Cónsul Jurídico el aviso de que hay borradores nuevos en el blog.
 * Lo dispara .github/workflows/aviso-borradores.yml cuando entra un .html en
 * blog/_borradores/.
 *
 * El título y el resumen NO se escriben a mano en ningún sitio: se leen del
 * propio HTML del borrador. Así el aviso no puede quedarse desincronizado del
 * contenido, que es lo que pasa siempre que hay dos sitios que dicen lo mismo.
 */
import { readFileSync } from 'node:fs'

const KEY = process.env.RESEND_API_KEY
const DESTINO = 'info@consuljuridico.com'

const ficheros = (process.env.LISTA ?? '')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean)

if (!ficheros.length) {
  console.log('Sin borradores que anunciar.')
  process.exit(0)
}

/** Saca un dato del HTML sin traerse un parser entero para cuatro etiquetas. */
function extraer(html, regex, porDefecto = '') {
  return (html.match(regex)?.[1] ?? porDefecto).replace(/\s+/g, ' ').trim()
}

function escapar(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const borradores = ficheros.map(ruta => {
  const html = readFileSync(ruta, 'utf8')
  const titulo = extraer(html, /<title>([^<]*)<\/title>/i, ruta)
    .replace(/\s*\|\s*Cónsul Jurídico\s*$/i, '')
  const resumen = extraer(html, /<meta name="description" content="([^"]*)"/i)
  // Cuántos bloques quedan por resolver: es el dato que decide si se puede
  // publicar o no, así que va en el aviso y no escondido en el fichero.
  const pendientes = (html.match(/<!--\s*VERIFICAR/g) ?? []).length
  return { ruta, titulo, resumen, pendientes }
})

const filas = borradores
  .map(
    b => `
  <tr><td style="padding:16px 0;border-top:1px solid #E6EAF1;">
    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#1B1F2A;">${escapar(b.titulo)}</p>
    ${b.resumen ? `<p style="margin:0 0 8px;font-size:13px;color:#566078;line-height:1.6;">${escapar(b.resumen)}</p>` : ''}
    <p style="margin:0;font-size:12px;color:#707A92;font-family:monospace;">${escapar(b.ruta)}</p>
    ${
      b.pendientes
        ? `<p style="margin:8px 0 0;font-size:12px;color:#92400E;font-weight:600;">${b.pendientes} bloque${b.pendientes === 1 ? '' : 's'} pendiente${b.pendientes === 1 ? '' : 's'} de verificar antes de publicar</p>`
        : ''
    }
  </td></tr>`,
  )
  .join('')

const n = borradores.length
const totalPendientes = borradores.reduce((s, b) => s + b.pendientes, 0)

const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;">
  <div style="background:#0D1017;border-radius:14px 14px 0 0;padding:24px 28px;">
    <p style="margin:0;color:#8D90FA;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">Cónsul Jurídico · Blog</p>
    <h1 style="margin:8px 0 0;color:#F6F7FA;font-size:20px;font-weight:600;">
      ${n} borrador${n === 1 ? '' : 'es'} nuevo${n === 1 ? '' : 's'} esperando tu revisión
    </h1>
  </div>
  <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:24px 28px;">
    <p style="margin:0;font-size:14px;color:#1B1F2A;line-height:1.6;">
      <strong>No est${n === 1 ? 'á publicado' : 'án publicados'}.</strong> Están en la carpeta de
      borradores, fuera del índice del blog y del sitemap, y con <code style="font-size:12px;">noindex</code>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">${filas}</table>
    ${
      totalPendientes
        ? `<div style="margin-top:18px;padding:14px 16px;background:#FEF7ED;border:1px solid #F5D9A8;border-radius:10px;">
             <p style="margin:0;font-size:13px;color:#78350F;line-height:1.6;">
               Quedan <strong>${totalPendientes}</strong> bloques marcados como <strong>VERIFICAR</strong>.
               Señalan afirmaciones que quien redactó el borrador no ha podido comprobar. Hay que
               resolverlos o quitarlos <strong>antes</strong> de publicar.
             </p>
           </div>`
        : ''
    }
    <p style="margin:18px 0 0;font-size:13px;color:#566078;line-height:1.6;">
      Cómo publicarlos: <code style="font-size:12px;">blog/_borradores/LEEME.md</code>.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#707A92;line-height:1.6;border-top:1px solid #E6EAF1;padding-top:14px;">
      Aviso automático. VELIA no publica nada en el blog por su cuenta: la decisión es siempre tuya.
    </p>
  </div>
</div>`

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    from: 'VELIA <noreply@veliacorp.com>',
    to: [DESTINO],
    reply_to: 'admin@veliacorp.com',
    // La fecha en el asunto evita que Gmail agrupe avisos de días distintos
    // en un solo hilo y el nuevo pase desapercibido bajo el viejo.
    subject: `Blog Cónsul Jurídico · ${n} borrador${n === 1 ? '' : 'es'} nuevo${n === 1 ? '' : 's'} (${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })})`,
    html,
  }),
})

const cuerpo = await res.text()
console.log('Resend HTTP', res.status, cuerpo.slice(0, 300))
// `fetch` no lanza con 401 ni 422. Si no se comprueba el estado, el Action
// terminaría en VERDE sin haber avisado a nadie.
if (!res.ok) {
  console.error('::error::El aviso NO se ha entregado.')
  process.exit(1)
}
