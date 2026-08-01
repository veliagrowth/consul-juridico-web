/**
 * Reescribe las tres tarjetas de blog de la PORTADA con las entradas más
 * recientes, leyéndolas de los propios artículos.
 *
 * POR QUÉ EXISTE (1-ago-2026, lo vio Joaquín): la portada enseñaba las tres
 * entradas ORIGINALES del sitio —de junio— mientras el blog ya iba por finales
 * de julio. No era un problema de orden: es que esas tres tarjetas están
 * escritas a mano en `index.html` y **nadie las actualizaba nunca**. El flujo de
 * publicación del portal (`publishPostToWeb`) reescribe `blog/index.html` y el
 * `sitemap.xml`, pero jamás tocó la portada. Así que cada entrada nueva salía en
 * el blog y la portada seguía anclada al día que se construyó el sitio.
 *
 * Ejecutar:  node scripts/actualizar-home-blog.mjs
 *
 * El bloque que se sustituye está delimitado por los marcadores
 * BLOG:PORTADA:INICIO / BLOG:PORTADA:FIN dentro de `.blog-grid`. Fuera de ellos
 * no se toca nada: es un reemplazo acotado, no una regeneración de la portada.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const BLOG = join(RAIZ, 'blog')
const PORTADA = join(RAIZ, 'index.html')
const CUANTAS = 3

const INICIO = '<!-- BLOG:PORTADA:INICIO — generado por scripts/actualizar-home-blog.mjs, no editar a mano -->'
const FIN = '<!-- BLOG:PORTADA:FIN -->'

function extraer(html, re, pordefecto = '') {
  return (html.match(re)?.[1] ?? pordefecto).replace(/\s+/g, ' ').trim()
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const enLetra = iso => {
  const [a, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

const entradas = readdirSync(BLOG)
  .filter(f => f.endsWith('.html') && f !== 'index.html')
  .map(f => {
    const html = readFileSync(join(BLOG, f), 'utf8')
    return {
      slug: f.replace(/\.html$/, ''),
      fecha: extraer(html, /"datePublished":\s*"([0-9-]{10})"/),
      // El sufijo « | Cónsul Jurídico» sirve en la pestaña del navegador y en
      // el buscador, pero dentro de la propia web es ruido: la tarjeta ya está
      // en la web del despacho. Los artículos generados automáticamente lo
      // llevan incluso en el og:title, así que se quita aquí y no allí.
      titulo: (extraer(html, /<meta property="og:title" content="([^"]*)"/)
        || extraer(html, /<title>([^<]*)<\/title>/))
        .replace(/\s*\|\s*Cónsul Jurídico\s*$/i, ''),
      extracto: extraer(html, /<meta name="description" content="([^"]*)"/),
      categoria: extraer(html, /<span class="article-cat">([^<]*)<\/span>/, 'Actualidad'),
    }
  })
  // Sin fecha no entra: preferimos una tarjeta de menos a una tarjeta mal
  // ordenada, que es justo lo que había que arreglar.
  .filter(e => e.fecha)
  .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  .slice(0, CUANTAS)

if (entradas.length < CUANTAS) {
  console.error(`Solo ${entradas.length} entradas con fecha; se esperaban ${CUANTAS}. Abortado.`)
  process.exit(1)
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const tarjetas = entradas
  .map(
    e => `
      <a href="/blog/${e.slug}.html" class="post-card">
        <div class="post-img">
          <img src="/blog/img/${e.slug}.jpg" alt="${esc(e.titulo)}" loading="lazy" decoding="async" width="400" height="180">
          <span class="post-cat">${esc(e.categoria)}</span>
        </div>
        <div class="post-body">
          <div class="post-date">${enLetra(e.fecha)}</div>
          <h3 class="post-title">${esc(e.titulo)}</h3>
          <p class="post-excerpt">${esc(e.extracto)}</p>
          <span class="post-more" data-i18n="blog.more">Leer más →</span>
        </div>
      </a>
`,
  )
  .join('')

const portada = readFileSync(PORTADA, 'utf8')
const i = portada.indexOf(INICIO)
const j = portada.indexOf(FIN)
if (i === -1 || j === -1) {
  console.error('No se encuentran los marcadores BLOG:PORTADA en index.html. Abortado.')
  process.exit(1)
}

const nuevo = portada.slice(0, i + INICIO.length) + '\n' + tarjetas + '      ' + portada.slice(j)
writeFileSync(PORTADA, nuevo)

console.log('Portada actualizada con las 3 entradas más recientes:')
for (const e of entradas) console.log(`  ${e.fecha}  ${e.titulo.slice(0, 62)}`)
