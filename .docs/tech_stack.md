# Tech Stack — Helados Chun Blum

## Stack tecnológico

| Capa | Tecnología | Versión | Notas |
|------|-----------|---------|-------|
| Frontend | HTML5 + CSS3 + JavaScript ES6+ | — | Sin frameworks. Módulos nativos del navegador. |
| Base de datos | Firebase Firestore | 10.11.0 | SDK web modular cargado desde CDN de gstatic |
| Autenticación | Firebase Authentication | 10.11.0 | Solo correo y contraseña |
| Hosting | Firebase Hosting | — | Plan Spark (gratuito) |
| Scripts Node.js | Firebase / dotenv / npm | 12.x | Solo para scripts de seed y utilidades |
| Control de versiones | Git + GitHub | — | Git Flow simplificado |

---

## Cómo importar Firebase en el navegador

**IMPORTANTE:** El proyecto usa la versión modular de Firebase cargada desde CDN, **no desde npm**. Esta es la forma correcta para todos los archivos JS del frontend:

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  onSnapshot, runTransaction, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
```

Luego importar `auth` y `db` desde el archivo de configuración:

```javascript
import { auth, db } from "./firebase-config.js";
```

> `firebase-config.js` está en `.gitignore` y **nunca se sube a GitHub**. Cada desarrollador debe crearlo localmente con sus credenciales. Ver `onboarding_chunblum.docx` para instrucciones.

---

## Patrón estándar de un archivo JS de página

Cada página del sistema sigue este patrón exacto. No apartarse de él.

```javascript
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { renderizarSidebar, configurarCerrarSesion } from "../js/sidebar.js";

// ── 1. Verificar autenticación y rol ──────────────────────────────
// SIEMPRE es lo primero. Definir qué roles pueden acceder.
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../pages/login.html";
    return;
  }

  const docSnap = await getDoc(doc(db, "usuarios", user.uid));

  // Ajustar el array de roles según la página
  if (!docSnap.exists() || !["admin"].includes(docSnap.data().rol)) {
    window.location.href = "../pages/login.html?error=permisos";
    return;
  }

  usuarioActual = { uid: user.uid, ...docSnap.data() };

  // Renderizar sidebar y configurar cerrar sesión SIEMPRE antes de inicializar
  renderizarSidebar(docSnap.data().rol, "nombre-pagina.html");
  configurarCerrarSesion();

  inicializarPagina();
});

// ── 2. Estado de la página ────────────────────────────────────────
let usuarioActual = null;

// ── 3. Referencias DOM ────────────────────────────────────────────
const miElemento = document.getElementById("miElemento");

// ── 4. Inicialización ─────────────────────────────────────────────
async function inicializarPagina() {
  await cargarDatos();
}

// ── 5. Funciones de datos ─────────────────────────────────────────
async function cargarDatos() {
  try {
    // lógica de carga
  } catch (error) {
    console.error("Error al cargar datos:", error);
  }
}
```

> **IMPORTANTE:** No agregar listeners de cerrar sesión manualmente en cada archivo.
> El `configurarCerrarSesion()` de `sidebar.js` lo maneja para todos los botones
> (`btnCerrarSesion` en móvil y `btnCerrarSesionSidebar` en escritorio).

---

## Sidebar dinámico — cómo usarlo

Todas las páginas con sidebar usan `sidebar.js` en lugar de definir los
enlaces manualmente en el HTML. Esto garantiza consistencia y actualización
automática según el rol del usuario.

### Importar en el archivo JS de la página

```javascript
import { renderizarSidebar, configurarCerrarSesion } from "../js/sidebar.js";
```

### Llamar dentro del onAuthStateChanged

```javascript
const rol = docSnap.data().rol;
renderizarSidebar(rol, "nombre-de-la-pagina.html");
configurarCerrarSesion();
```

### Estructura mínima del sidebar en el HTML

```html
<aside class="sidebar">
  <div class="sidebar-logo">
    <h1>Helados Chun Blum</h1>
    <p>Cargando...</p>
  </div>
  <nav class="sidebar-nav"></nav>
  <div class="sidebar-footer">
    <button id="btnCerrarSesionSidebar">Cerrar sesión</button>
  </div>
</aside>
```

### Para agregar un ítem nuevo al menú

Solo tocar `public/js/sidebar.js` — agregar el ítem en el array `MENU_ITEMS`
con su `label`, `href` y los `roles` que pueden verlo. No tocar los HTML.

```javascript
{
  label: "Nueva sección",
  href:  "nueva-seccion.html",
  roles: ["admin", "vendedor"],
},
```

### Ítems actuales del menú y roles que los ven

| Ítem del menú | Roles que lo ven |
|---------------|-----------------|
| Inicio | `admin` |
| Usuarios | `admin` |
| Inventario | `admin`, `operaria` |
| Registrar lote | `admin`, `operaria` |
| Pedidos | `admin`, `vendedor` |
| Mis pedidos | `distribuidor` |

---

## Roles y páginas que pueden acceder

| Página | Roles permitidos |
|--------|-----------------|
| `login.html` | Sin autenticación |
| `dashboard.html` | `admin` |
| `usuarios.html` | `admin` |
| `inventario.html` | `admin`, `operaria` |
| `produccion.html` | `admin`, `operaria` |
| `pedidos.html` | `admin`, `vendedor` |
| `catalogo.html` | `distribuidor` |

**Implementación del guard de ruta:**
```javascript
if (!docSnap.exists() || !["rol1", "rol2"].includes(docSnap.data().rol)) {
  window.location.href = "../pages/login.html?error=permisos";
  return;
}
```

---

## Operaciones de Firestore — patrones usados

### Leer una sola vez
```javascript
const snap = await getDocs(collection(db, "productos"));
snap.forEach(doc => console.log(doc.id, doc.data()));
```

### Leer en tiempo real (onSnapshot)
Usar para vistas que deben actualizarse automáticamente sin recargar.
```javascript
const q = query(collection(db, "productos"), orderBy("nombre"));
const unsubscribe = onSnapshot(q, (snapshot) => {
  snapshot.forEach(doc => renderizarProducto(doc.id, doc.data()));
});
// Llamar unsubscribe() al salir de la página para evitar memory leaks
```

### Transacción atómica (runTransaction)
Usar SIEMPRE que se modifique el stock. Garantiza consistencia ante accesos simultáneos.
```javascript
await runTransaction(db, async (transaction) => {
  const ref = doc(db, "productos", productoId);
  const snap = await transaction.get(ref);
  const nuevoStock = snap.data().stockDisponible + cantidad;
  transaction.update(ref, {
    stockDisponible: nuevoStock,
    estado: nuevoStock > 0 ? "disponible" : "agotado",
    ultimaActualizacion: new Date().toISOString(),
  });
});
```

### Escritura en lote (writeBatch)
Usar cuando se necesita escribir múltiples documentos de forma atómica.
```javascript
const batch = writeBatch(db);
batch.set(doc(collection(db, "coleccion")), datos1);
batch.update(doc(db, "coleccion", id), datos2);
await batch.commit();
```

### Consultas con filtros
```javascript
const q = query(
  collection(db, "pedidos"),
  where("distribuidorId", "==", uid),
  where("estado", "in", ["pendiente", "confirmado"]),
  orderBy("fechaEntregaSolicitada", "asc"),
  limit(20)
);
```

---

## Convenciones de código

### Idioma
- **Español** para: nombres de variables, funciones, comentarios, mensajes de UI, commits
- **Inglés** solo para: nombres de archivos, clases CSS, IDs del DOM, propiedades de Firestore

```javascript
// ✅ Correcto
async function cargarProductos() { ... }
let todosLosUsuarios = [];
// Cargar productos desde Firestore

// ❌ Incorrecto
async function loadProducts() { ... }
let allUsers = [];
// Load products from Firestore
```

### Nomenclatura
```javascript
// Variables y funciones: camelCase en español
let stockDisponible = 0;
async function registrarLote() { ... }
function validarFormulario() { ... }
function renderizarUsuarios(lista) { ... }

// Constantes: camelCase también (no UPPER_CASE)
const umbralMinimo = 20;

// IDs del DOM: camelCase en español
document.getElementById("btnGuardar")
document.getElementById("inputCantidad")
document.getElementById("selectProducto")
document.getElementById("alertaError")
document.getElementById("listaUsuarios")
```

### Manejo de errores
Siempre usar try/catch en operaciones de Firebase. Mostrar errores al usuario, nunca silenciarlos.

```javascript
try {
  await operacionFirebase();
  alertaExito.classList.add("visible");
} catch (error) {
  alertaError.textContent = `Error: ${error.message}`;
  alertaError.classList.add("visible");
} finally {
  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar";
}
```

### Eventos de formulario
Usar siempre `addEventListener` con `function` explícita, nunca arrow function anónima para eventos de submit.

```javascript
// ✅ Correcto
formMiPagina.addEventListener("submit", async function(e) {
  e.preventDefault();
  e.stopPropagation();
  // lógica
});

// ❌ Incorrecto — puede causar problemas con e.preventDefault()
formMiPagina.addEventListener("submit", async (e) => { ... });
```

---

## Flujo de Git

### Ramas
- `main` — producción. Solo recibe merges desde `develop` al cerrar sprint.
- `develop` — integración. Todas las historias confluyen aquí vía PR.
- `feature/isg-[numero]-hu-[X.X]-descripcion` — una por historia de usuario.
- `chore/descripcion` — para mejoras técnicas transversales sin funcionalidad nueva.
- `hotfix/descripcion` — solo para bugs críticos en producción.

### Crear rama y trabajar
```bash
git checkout develop
git pull origin develop
git checkout -b feature/isg-38-hu-2.3-catalogo-productos

# trabajar...
git add .
git commit -m "feat: descripcion de lo que se hizo"
git push origin feature/isg-38-hu-2.3-catalogo-productos
```

### Abrir Pull Request
- **base:** `develop` ← **compare:** `feature/isg-XX-hu-X.X`
- Título: `feat: (ISG-XX) HU-X.X descripcion corta`
- Asignar a Eliana Jaramillo como reviewer
- No hacer merge sin aprobación de la líder
- Incluir descripción con: qué se hizo, cómo probarlo y criterios verificados

### Convención de commits
```
feat:     nueva funcionalidad
fix:      corrección de bug
style:    cambios de CSS/UI sin lógica
refactor: mejora de código sin cambio funcional
docs:     comentarios o documentación
chore:    tareas técnicas (configuración, dependencias)
```

---

## Estructura de archivos

```
chun-blum/
├── public/
│   ├── assets/                 ← imágenes, íconos
│   ├── css/
│   │   └── styles.css          ← ÚNICO archivo de estilos
│   ├── js/
│   │   ├── firebase-config.js  ← NO está en Git (.gitignore)
│   │   ├── auth.js             ← lógica de login y redirección por rol
│   │   ├── sidebar.js          ← sidebar dinámico centralizado por rol
│   │   ├── usuarios.js         ← HU-1.2 gestión de usuarios
│   │   ├── produccion.js       ← HU-2.1 registro de lotes
│   │   ├── inventario.js       ← HU-2.2 vista de inventario
│   │   └── [pagina].js         ← un archivo JS por cada página nueva
│   ├── pages/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── usuarios.html
│   │   ├── inventario.html
│   │   ├── produccion.html
│   │   ├── pedidos.html
│   │   └── catalogo.html
│   └── index.html              ← redirige automáticamente a login.html
├── scripts/
│   └── seed-productos.js       ← script Node.js para cargar datos iniciales
├── .docs/
│   ├── project_scope.md        ← alcance, colecciones Firestore y reglas de negocio
│   ├── design_system.md        ← componentes, variables CSS y convenciones UI
│   └── tech_stack.md           ← este archivo
├── .env                        ← NO está en Git (.gitignore)
├── .firebaserc
├── .gitignore
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
└── package.json
```

---

## Comandos frecuentes

```bash
# Levantar servidor local
firebase serve --only hosting

# Desplegar a producción
firebase deploy --only hosting

# Ejecutar script de seed de productos
node scripts/seed-productos.js

# Ver ramas locales
git branch

# Actualizar rama local desde remoto
git pull origin develop

# Crear rama nueva desde develop actualizado
git checkout develop && git pull origin develop && git checkout -b feature/isg-XX-hu-X.X-descripcion
```

---

## Lo que NO se debe hacer

- ❌ Importar Firebase desde npm en archivos del frontend (solo para scripts Node.js)
- ❌ Hacer commit de `firebase-config.js` o `.env`
- ❌ Crear archivos CSS adicionales o usar `<style>` en HTML
- ❌ Hacer push directo a `main` o `develop` con código funcional
- ❌ Modificar el stock sin usar `runTransaction`
- ❌ Usar `var` — solo `const` y `let`
- ❌ Usar `.then()` encadenados — solo `async/await`
- ❌ Dejar `console.log` en código que va a PR
- ❌ Crear colecciones nuevas en Firestore sin coordinarlo con Eliana
- ❌ Agregar listeners de cerrar sesión manualmente — usar `configurarCerrarSesion()` de `sidebar.js`
- ❌ Definir enlaces del sidebar en el HTML — el `sidebar.js` los genera dinámicamente
- ❌ Crear un nuevo media query en styles.css — agregar dentro del `@media (min-width: 768px)` existente