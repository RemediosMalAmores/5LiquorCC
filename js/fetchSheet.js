const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJxayf83JWsgYpaIJhOGBNdOqDb6ucU7Evf--wTsrwaN3SNLjDBFATMCCJr69ApA/pub?gid=1370319565&single=true&output=csv";

/* === Parser CSV === */
function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* === Lector principal === */
async function getProducts() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();
  const rows = parseCSV(text);
  if (!rows.length) return [];

  // Cabeceras esperadas
  const headers = rows.shift().map(h => (h || "").trim().toLowerCase());
 const idx = {
    clase: headers.indexOf("cse_prod"),
    codigo: headers.indexOf("cve_prod"),
    desc: headers.indexOf("desc_prod"),
    stock: headers.indexOf("existencias"),
    img: headers.indexOf("cve_image"),
    verif: headers.indexOf("verificado")
};

  if (Object.values(idx).some(i => i === -1)) {
    console.error("⚠️ No se encontraron columnas esperadas.");
    return [];
  }

  // Procesar filas a objetos normalizados
  const raw = rows.map(r => {
    const clase = (r[idx.clase] || "").trim().toLowerCase();
    const codigo = (r[idx.codigo] || "").trim();
    const desc = (r[idx.desc] || "").trim();
    const stock = parseInt((r[idx.stock] || "").trim()) || 0;
    const imagen_name = (r[idx.img] || "").trim();
    const verificadoRaw = (r[idx.verif] || "").toString().trim().toLowerCase();

// solo validar que haya código y descripción
if (!codigo || !desc) return null;

// Google Sheets suele exportar checkbox como TRUE/FALSE.
// Aun así, soportamos varias variantes por si acaso.
const checked =
  verificadoRaw === "true" ||
  verificadoRaw === "verdadero" ||
  verificadoRaw === "1" ||
  verificadoRaw === "sí" ||
  verificadoRaw === "si";

if (!checked) return null;


    // Detectar presentación real
    const presMatch = desc.match(/([0-9]+ ?m?l|[0-9]+ ?l|[0-9]+ ?lt)/i);
    const presentacion = presMatch ? presMatch[1].replace(/\s+/g, "").toLowerCase() : "";

    // === LIMPIEZA PREMIUM ===
    let nombre = desc;

    // 1. eliminar patrones de presentación: 750ml, 750 ml, 1L, 1lt
    nombre = nombre
      .replace(/\b[0-9]+\s*(ml|l|lt)\b/gi, "")
      .replace(/[0-9]+ml/gi, "")
      .replace(/[0-9]+l/gi, "")
      .replace(/[0-9]+lt/gi, "");

    // 2. eliminar palabras basura
    nombre = nombre
      .replace(/\b(botella|caja|pieza|pza|pzas|piezas|unidad|pack|6pack)\b/gi, "")
      .replace(/\blitro?s?\b/gi, "");

    // 3. eliminar porcentajes de alcohol
    nombre = nombre.replace(/[0-9]+%/gi, "").replace(/[0-9]+ ?vol/gi, "");

    // 4. eliminar patrones tipo 12/4, 1//, 6-1
    nombre = nombre.replace(/(\s?\d+\s*(?:\/{1,2}\s*\d*)+)/gi, "");
    nombre = nombre.replace(/(\d+-\d+)/gi, "");

    // 5. eliminar guiones, barras y símbolos basura
    nombre = nombre.replace(/[/\-•–—]+/g, " ");

    // 6. eliminar números sueltos que no sean parte del nombre
    nombre = nombre.replace(/\b[0-9]+\b/g, "");

    // 7. normalizar espacios
    nombre = nombre.replace(/\s{2,}/g, " ").trim();

    // 8. capitalizar correctamente
    nombre = nombre.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    return { clase, nombre, codigo, presentacion, stock, imagen_name };
  }).filter(Boolean);

  const totalRows = rows.length;
  const filteredRows = raw.length;

  // Agrupar productos por nombre + imagen
  const map = new Map();
  for (const p of raw) {
    const key = `${p.nombre.toLowerCase()}_${p.imagen_name}`;
    if (!map.has(key)) {
      map.set(key, {
        clase: p.clase,
        nombre: p.nombre,
        imagen_name: p.imagen_name,
        presentaciones: []
      });
    }
    const prod = map.get(key);

    const existing = prod.presentaciones.find(x => x.presentacion === p.presentacion);
    if (existing) {
      if (p.stock > existing.stock) existing.codigo = p.codigo;
      existing.stock = Math.max(existing.stock, p.stock);
    } else {
      prod.presentaciones.push({ presentacion: p.presentacion, codigo: p.codigo, stock: p.stock });
    }
  }

  const finalProducts = Array.from(map.values());

  console.log(`✅ Productos cargados: ${finalProducts.length} visibles de ${totalRows} filas totales (${filteredRows} con stock válido)`);

  return finalProducts;
}
