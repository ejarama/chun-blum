# Design System — Helados Chun Blum

## Principios de diseño

- **Mobile-first:** Todos los componentes se diseñan primero para móvil y luego se adaptan a escritorio con media queries.
- **Consistencia:** Usar siempre los componentes y variables ya definidos. No crear estilos inline ni clases nuevas sin revisar si ya existe algo equivalente.
- **Sencillez:** Los usuarios tienen nivel tecnológico básico-intermedio. La interfaz debe ser autoexplicativa sin necesidad de capacitación.
- **Un solo archivo CSS:** Todos los estilos van en `public/css/styles.css`. No crear archivos CSS adicionales ni usar `<style>` dentro de los HTML.

---

## Variables CSS globales

Definidas en `:root` en `styles.css`. **Usar siempre estas variables, nunca valores hardcodeados.**

```css
--azul-principal: #1a73e8;    /* Color primario — botones, enlaces, sidebar */
--azul-hover:     #1557b0;    /* Hover de elementos azules */
--rojo-error:     #d93025;    /* Errores, validaciones, alertas críticas */
--gris-texto:     #3c4043;    /* Texto principal */
--gris-claro:     #f1f3f4;    /* Fondo de página */
--gris-borde:     #dadce0;    /* Bordes de inputs y separadores */
--blanco:         #ffffff;    /* Fondos de cards y modales */
--sombra:         0 2px 10px rgba(0,0,0,0.12);  /* Sombra de cards */
--radio:          8px;        /* Border-radius estándar */
```

---

## Layout

### Móvil (< 768px)
- Navbar fija en la parte superior con el título de la página y botón "Salir"
- Contenido en columna única con padding de 16px
- El sidebar está oculto (`display: none`)

### Escritorio (≥ 768px)
- Sidebar fijo a la izquierda de 240px de ancho con fondo `--azul-principal`
- El navbar móvil está oculto (`display: none`)
- El contenido tiene `margin-left: 240px` y padding de 28px 32px

### Clases de layout obligatorias
```html
<body class="pagina">           <!-- flex-direction: column en móvil, row en desktop -->
  <aside class="sidebar">...</aside>       <!-- visible solo en desktop -->
  <nav class="navbar">...</nav>            <!-- visible solo en móvil -->
  <div class="contenido">...</div>         <!-- área de contenido principal -->
</body>
```

---

## Estructura del sidebar (escritorio)

Cada página que accede el admin, operaria o vendedor debe incluir este sidebar. Ajusta el enlace `class="activo"` según la página actual.

```html
<aside class="sidebar">
  <div class="sidebar-logo">
    <h1>Helados Chun Blum</h1>
    <p>Panel de [rol]</p>
  </div>
  <nav class="sidebar-nav">
    <a href="dashboard.html">Inicio</a>
    <a href="[pagina-actual].html" class="activo">Nombre sección</a>
    <!-- agregar los enlaces según el rol -->
  </nav>
  <div class="sidebar-footer">
    <button id="btnCerrarSesionSidebar">Cerrar sesión</button>
  </div>
</aside>
```

---

## Componentes disponibles

### Card
Contenedor blanco con sombra. Usar para agrupar contenido relacionado.
```html
<div class="card">
  <div class="card-header">
    <h3>Título de la sección</h3>
    <button class="btn-primario btn-sm">+ Acción</button>
  </div>
  <!-- contenido -->
</div>
```

### Botones
```html
<button class="btn-primario">Acción principal</button>   <!-- azul sólido -->
<button class="btn-secundario">Acción secundaria</button> <!-- gris con borde -->
<button class="btn-primario btn-sm">+ Nuevo</button>     <!-- versión pequeña -->
<button class="btn-login">Ingresar</button>              <!-- ancho completo, para formularios -->
```

### Formularios
```html
<div class="form-group">
  <label for="miInput">Etiqueta</label>
  <input type="text" id="miInput" placeholder="Placeholder" />
  <span class="error-msg" id="errorMiInput">Mensaje de error.</span>
</div>

<!-- Select -->
<select id="miSelect" class="form-select">
  <option value="">— Selecciona —</option>
</select>

<!-- Textarea -->
<textarea id="miTextarea" class="form-textarea" placeholder="..."></textarea>
```

**Clases de validación:**
```javascript
input.classList.add("input-error");      // borde rojo
errorMsg.classList.add("visible");       // muestra el mensaje de error
```

### Alertas
```html
<div class="alert-error" id="alertaError">Mensaje de error.</div>
<div class="alert-success" id="alertaExito">Operación exitosa.</div>
```
Se muestran/ocultan con `.classList.add("visible")` / `.classList.remove("visible")`.

### Filtros / buscador
```html
<div class="filtros-bar">
  <input type="text" id="buscador" class="filtro-input" placeholder="Buscar..." />
  <select id="filtroEstado" class="filtro-select">
    <option value="">Todos</option>
  </select>
</div>
```

### Badges de estado
```html
<span class="badge-rol">distribuidor</span>
<span class="badge-estado badge-activo">Activo</span>
<span class="badge-estado badge-inactivo">Inactivo</span>
<span class="stock-badge stock-disponible">disponible</span>
<span class="stock-badge stock-agotado">agotado</span>
<span class="stock-badge stock-produccion">en producción</span>
```

### Loading / empty state
```html
<div class="loading">Cargando...</div>
<div class="empty-state">No hay registros.</div>
```

### Modal (bottom sheet en móvil, centrado en desktop)
```html
<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <h3>Título del modal</h3>
    <!-- contenido -->
    <div class="modal-acciones">
      <button class="btn-secundario" id="btnCancelar">Cancelar</button>
      <button class="btn-primario" id="btnGuardar">Guardar</button>
    </div>
  </div>
</div>
```
Mostrar/ocultar: `modalOverlay.classList.add("visible")` / `.remove("visible")`.

---

## Paleta de colores de estado

| Estado | Fondo | Texto | Clase CSS |
|--------|-------|-------|-----------|
| Disponible / Activo | `#e6f4ea` | `#1e7145` | `badge-activo` / `stock-disponible` |
| Agotado / Inactivo | `#fce8e6` | `#d93025` | `badge-inactivo` / `stock-agotado` |
| En producción | `#fff3e0` | `#e65100` | `stock-produccion` |
| Error / Alerta | `#fce8e6` | `#d93025` | `alert-error` |
| Éxito | `#e6f4ea` | `#1e7145` | `alert-success` |

---

## Tipografía

- **Fuente:** `'Segoe UI', Arial, sans-serif`
- **Tamaño base:** 15px para inputs, 14px para texto general, 12px para metadatos
- **Pesos:** 400 regular, 500 medio, 600 para títulos de card

---

## Responsive — cómo agregar estilos de escritorio

Siempre al final de `styles.css`, dentro del media query existente:

```css
@media (min-width: 768px) {
  /* tus estilos específicos para esta página en desktop */
  .mi-componente {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

**Nunca crear un nuevo media query — agregar dentro del que ya existe.**

---

## Checklist de UI antes de hacer commit

- [ ] La página tiene `<body class="pagina">` con sidebar y navbar
- [ ] El enlace activo en el sidebar tiene `class="activo"`
- [ ] Los estilos nuevos están al final de `styles.css` con comentario de sección
- [ ] Los formularios tienen validación visual (clase `input-error` y mensajes `error-msg`)
- [ ] La página funciona correctamente en móvil (375px) y escritorio (1280px)
- [ ] No hay estilos inline en el HTML
- [ ] No hay `console.log` en el código final
