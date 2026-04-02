# Tech Stack — Helados Chun Blum

## Stack tecnológico

| Capa | Tecnología | Versión | Notas |
|------|-----------|---------|-------|
| Frontend | HTML5 + CSS3 + JavaScript ES6+ | — | Sin frameworks. Módulos nativos del navegador. |
| Base de datos | Firebase Firestore | 10.11.0 | SDK web modular cargado desde CDN de gstatic |
| Autenticación | Firebase Authentication | 10.11.0 | Solo correo y contraseña |
| Hosting | Firebase Hosting | — | Plan Spark (gratuito) |
| Scripts Node.js | Firebase Admin / npm | 12.x | Solo para scripts de seed y utilidades |
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
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
  inicializarPagina(); // llamar función de inicialización
});

// ── 2. Estado de la página ────────────────────────────────────────
let usuarioActual = null;

// ── 3. Referencias DOM ────────────────────────────────────────────
const miElemento = document.getElementById("miElemento");

// ── 4. Cerrar sesión ──────────────────────────────────────────────
// Incluir siempre ambos botones (móvil y sidebar desktop)
document.getElementById("btnCerrarSesion")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../pages/login.html";
});

document.getElementById("btnCerrarSesionSidebar")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../pages/login.html";
});

// ── 5. Inicialización ─────────────────────────────────────────────
async function inicializarPagina() {
  await cargarDatos();
}

// ── 6. Funciones de datos ─────────────────────────────────────────
async function cargarDatos() {
  try {
    // lógica de carga
  } catch (error) {
    console.error("Error al cargar datos:", error);
  }
}
```

---

## Roles y páginas que pueden acceder

| Página | Roles permitidos |
|--------|-----------------|
| `login.html` | Sin autenticación |
| `dashboard.html` | `admin` |
| `usuarios.html` | `admin` |
| `inventario.html` | `admin` |
| `produccion.html` | `operaria`, `admin` |
| `pedidos.html` | `vendedor`, `admin` |
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
- `feature/hu-X.X-descripcion` — una por historia de usuario.

### Crear rama y trabajar
```bash
git checkout develop
git pull origin develop
git checkout -b feature/hu-2.2-inventario-admin

# trabajar...
git add .
git commit -m "feat: descripcion de lo que se hizo"
git push origin feature/hu-2.2-inventario-admin
```

### Abrir Pull Request
- **base:** `develop` ← **compare:** `feature/hu-X.X`
- Asignar a Eliana Jaramillo como reviewer
- No hacer merge sin aprobación de la líder

### Convención de commits
```
feat:     nueva funcionalidad
fix:      corrección de bug
style:    cambios de CSS/UI sin lógica
refactor: mejora de código sin cambio funcional
docs:     comentarios o documentación
```

---

## Estructura de archivos

```
chun-blum/
├── public/
│   ├── assets/               ← imágenes, íconos
│   ├── css/
│   │   └── styles.css        ← ÚNICO archivo de estilos
│   ├── js/
│   │   ├── firebase-config.js  ← NO está en Git (.gitignore)
│   │   ├── auth.js           ← lógica de login
│   │   ├── router.js         ← protección de rutas (próximo)
│   │   ├── usuarios.js       ← HU-1.2
│   │   ├── produccion.js     ← HU-2.1
│   │   └── [pagina].js       ← un archivo por página
│   ├── pages/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── usuarios.html
│   │   ├── inventario.html
│   │   ├── produccion.html
│   │   ├── pedidos.html
│   │   └── catalogo.html
│   └── index.html            ← redirige a login.html
├── scripts/
│   └── seed-productos.js     ← script Node.js para datos iniciales
├── .docs/
│   ├── project_scope.md      ← este archivo y los otros dos
│   ├── design_system.md
│   └── tech_stack.md
├── .env                      ← NO está en Git (.gitignore)
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

# Ejecutar script de seed
node scripts/seed-productos.js

# Ver ramas locales
git branch

# Actualizar rama local desde remoto
git pull origin develop
```

---

## Lo que NO se debe hacer

- ❌ Importar Firebase desde npm en archivos del frontend (solo para scripts Node.js)
- ❌ Hacer commit de `firebase-config.js` o `.env`
- ❌ Crear archivos CSS adicionales o usar `<style>` en HTML
- ❌ Hacer push directo a `main` o `develop`
- ❌ Modificar el stock sin usar `runTransaction`
- ❌ Usar `var` — solo `const` y `let`
- ❌ Usar `.then()` encadenados — solo `async/await`
- ❌ Dejar `console.log` en código que va a PR
- ❌ Crear colecciones nuevas en Firestore sin coordinarlo con Eliana
