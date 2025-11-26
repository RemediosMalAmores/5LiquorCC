// ======= Estado global =======
let DATA = [];
let carrito = [];
let seleccion = {};
let filtro = "all";

const EXT = [".webp", ".jpg", ".jpeg", ".png"];
const WHATSAPP = "528120744794";

// ======= Utils =======
function normalizeId(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function imgWithFallback(clase, name) {
  const base = `imagenes-producto/${name}`;
  return `<img src="${base}${EXT[0]}" onerror="tryNextExt(this,'${base}',1)" alt="">`;
}

function tryNextExt(img, base, i) {
  if (i >= EXT.length) { img.onerror = null; img.src = ""; return; }
  img.onerror = () => tryNextExt(img, base, i + 1);
  img.src = base + EXT[i];
}

// ======= Chips =======
function renderChips() {
  const clases = Array.from(new Set(DATA.map(p => p.clase))).sort();
  const chips = document.getElementById("chips");
  chips.innerHTML = `<button class="chip ${filtro === 'all' ? 'active' : ''}" data-clase="all">Todas</button>` +
    clases.map(c => `<button class="chip ${filtro === c ? 'active' : ''}" data-clase="${c}">${c[0].toUpperCase() + c.slice(1)}</button>`).join("");

  chips.onclick = e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    document.querySelectorAll(".chip").forEach(ch => ch.classList.remove("active"));
    btn.classList.add("active");
    filtro = btn.dataset.clase;
    renderGrid();
  };
}

// ======= Grid de productos =======
function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const productos = DATA.filter(p => filtro === "all" || p.clase === filtro);

  productos.forEach(p => {
    const pid = normalizeId(`${p.clase}-${p.imagen_name}-${p.nombre}`);

    p.presentaciones.sort((a,b)=>{
  const na=parseInt(a.presentacion.replace(/ml|l/gi,""))||0;
  const nb=parseInt(b.presentacion.replace(/ml|l/gi,""))||0;
  return na-nb;
});
const presBtns = p.presentaciones.map((pr,i)=>
      `<button class="pres-btn ${i === 0 ? "active" : ""}" data-role="sel" data-pid="${pid}" data-pres="${pr.presentacion}" data-code="${pr.codigo}">${pr.presentacion.replace(/ml|l/gi,"")}</button>`
    ).join("");

    // preselección
    if (!seleccion[pid]) {
      seleccion[pid] = { presentacion: p.presentaciones[0].presentacion, codigo: p.presentaciones[0].codigo };
    }

    grid.insertAdjacentHTML("beforeend", `
      <div class="card" data-pid="${pid}">
        <div class="card-img">${imgWithFallback(p.clase, p.imagen_name)}</div>
        <h3>${p.nombre}</h3>
        <div class="presentaciones">${presBtns}</div>
        <div class="cantidad">
          <button data-role="dec" data-pid="${pid}">-</button>
          <input id="cant-${pid}" type="number" value="1" min="1" max="999">
          <button data-role="inc" data-pid="${pid}">+</button>
        </div>
        <button class="agregar" data-role="add" data-pid="${pid}">Agregar</button>
      </div>
    `);
  });

  grid.onclick = onGridClick;
}

function onGridClick(e) {
  const el = e.target.closest("[data-role]");
  if (!el) return;
  const role = el.dataset.role;
  const pid = el.dataset.pid;
  const product = DATA.find(p => normalizeId(`${p.clase}-${p.imagen_name}-${p.nombre}`) === pid);
  if (!product) return;

  if (role === "sel") {
    el.parentElement.querySelectorAll(".pres-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
    seleccion[pid] = { presentacion: el.dataset.pres, codigo: el.dataset.code };
    return;
  }

  const input = document.getElementById(`cant-${pid}`);
  let v = parseInt(input.value) || 1;

  if (role === "dec") input.value = Math.max(1, v - 1);
  if (role === "inc") input.value = Math.min(999, v + 1);
  if (role === "add") {
    addProduct(product, Math.max(1, v), pid);
    pulseFab();
  }
}

// ======= Carrito =======
function addProduct(product, cantidad, pid) {
  const sel = seleccion[pid];
  if (!sel) return alert("Selecciona una presentación");

  const existing = carrito.find(i => i.codigo === sel.codigo && i.presentacion === sel.presentacion && i.nombre === product.nombre);
  if (existing) existing.cantidad += cantidad;
  else carrito.push({ codigo: sel.codigo, nombre: product.nombre, presentacion: sel.presentacion, cantidad });

  paint();
}

function removeItem(index) {
  carrito.splice(index, 1);
  paint();
}

function vaciar() {
  carrito = [];
  paint();
}

function renderCarritoHTML(list) {
  if (!list.length) return "<p class='vacio'>Vacío</p>";
  return list.map((i, idx) => `
    <div class="item-carrito sin-img">
      <div class="info">
        <div class="nombre">${i.nombre}</div>
        <div class="desc">Presentación: <b>${i.presentacion.toUpperCase()}</b></div>
        <div class="cant">Cantidad: <b>${i.cantidad}</b></div>
      </div>
      <button class="borrar" onclick="removeItem(${idx})" title="Eliminar">✖</button>
    </div>
  `).join("");
}

function paint() {
  const box = document.getElementById("carrito");
  const mob = document.getElementById("mobileCarrito");
  const cartBtn = document.getElementById("cartBtn");

  // pinta desktop
  if (box) box.innerHTML = renderCarritoHTML(carrito);
  // pinta móvil
  if (mob) mob.innerHTML = renderCarritoHTML(carrito);

  // contador FAB
  if (cartBtn) {
    let badge = cartBtn.querySelector('.cart-badge');
    const count = carrito.reduce((acc, i) => acc + i.cantidad, 0);
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'cart-badge';
      cartBtn.appendChild(badge);
    }
    badge.textContent = count ? String(count) : "";
    badge.classList.remove('badge-bounce');
    // forzar reflow para animación
    void badge.offsetWidth;
    badge.classList.add('badge-bounce');
  }
}

// ======= WhatsApp + copiar tabla =======
function wa() {
  if (!carrito.length) return alert("Carrito vacío");

  const clienteDesktop = document.getElementById("cliente");
  const clienteMobile = document.getElementById("cliente-mob");
  const cliente = (clienteDesktop?.value || clienteMobile?.value || "").trim();

  if (!cliente) {
    const ok = confirm("No escribiste el nombre del cliente. ¿Deseas continuar sin él?");
    if (!ok) return;
  }

  let msg = "";
  if (cliente) msg += `Cliente: ${cliente}\n\n`;

  carrito.forEach(i => { msg += `${i.codigo}\t${i.cantidad}\n`; });
  msg += "\n";
  carrito.forEach((i, idx) => {
    msg += `${idx + 1}. ${i.nombre} ${i.presentacion.toUpperCase()} (${i.cantidad} UDS)*\n`;
  });

  // Copiar con CRLF para Excel
  navigator.clipboard.writeText(msg.replace(/\n/g, "\r\n")).catch(() => {});
  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${WHATSAPP}?text=${encoded}`, "_blank");
}

// ======= Interacciones UI =======
function pulseFab() {
  const fab = document.getElementById('cartBtn');
  if (!fab) return;
  fab.classList.remove('pulse');
  void fab.offsetWidth; // reflow
  fab.classList.add('pulse');
}

// sincronizar nombre entre desktop/móvil
document.addEventListener("input", e => {
  if (e.target.id === "cliente" && document.getElementById("cliente-mob")) {
    document.getElementById("cliente-mob").value = e.target.value;
  } else if (e.target.id === "cliente-mob" && document.getElementById("cliente")) {
    document.getElementById("cliente").value = e.target.value;
  }
});

// abrir/cerrar carrito móvil
function setupMobileCart() {
  const btn = document.getElementById("cartBtn");
  const modal = document.getElementById("mobileCart");
  const close = document.getElementById("closeCart");
  if (!btn || !modal || !close) return;

  btn.addEventListener("click", () => {
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  });
  close.addEventListener("click", () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  });

  // cerrar al tocar afuera (zona oscura)
  modal.addEventListener("click", (e) => {
    const isInside = e.target.closest(".mobile-cart-header, .mobile-cart-body, .actions, .legal");
    if (!isInside) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    }
  });
}

// ======= Popup Edad (CSS sin conflicto) =======
function setupAgeGate() {
  const modalOverlay = document.getElementById("ageModal");
  const btnSi = document.getElementById("btnSi");
  const btnNo = document.getElementById("btnNo");
  if (!modalOverlay || !btnSi || !btnNo) return;

  // Mostrar solo si no está verificado
  if (!localStorage.getItem("rma_age_verified")) {
    modalOverlay.classList.add("active");
  }

  btnSi.onclick = () => {
    localStorage.setItem("rma_age_verified", "true");
    modalOverlay.classList.remove("active");
  };

  btnNo.onclick = () => {
    window.location.href = "https://www.gob.mx/cofepris/articulos/advertencia-sobre-el-consumo-de-bebidas-alcoholicas";
  };

  // Atajo para reiniciar verificación
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      alert("Verificación reiniciada. El popup volverá a mostrarse.");
      localStorage.removeItem("rma_age_verified");
      modalOverlay.classList.add("active");
    }
  });
}

// ======= Carga inicial =======
document.addEventListener("DOMContentLoaded", () => {
  setupAgeGate();
  setupMobileCart();

  getProducts().then(products => {
    DATA = products;
    renderChips();
    renderGrid();
    paint();
  }).catch(() => {
    // En caso de error, deja el grid vacío pero no rompas la página
    document.getElementById("grid").innerHTML = "<p style='opacity:.6'>No se pudo cargar el catálogo por el momento.</p>";
  });
});
