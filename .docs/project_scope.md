# Project Scope — Helados Chun Blum

## Descripción del proyecto

Sistema web de gestión de inventario y pedidos para el emprendimiento **Helados Chun Blum**, ubicado en Santa Fe de Antioquia, Colombia. Reemplaza el flujo actual basado en Google Sheets y WhatsApp.

**URL de producción:** https://chun-blum.web.app  
**Repositorio:** github.com/equipo/chun-blum  
**Estado:** En desarrollo activo — Sprint 2 de 6

---

## Contexto de negocio

- Chun Blum produce y vende helados cremosos artesanales ("cremas cremositas")
- Tiene entre 10 y 20 distribuidores activos en Santa Fe de Antioquia y alrededores
- Los distribuidores pueden ser puntos de venta directos o personas que atienden varios puntos
- Los pedidos se generan con mínimo 2 días de anticipación
- El pago se realiza en efectivo o transferencia al momento de la entrega
- El negocio maneja 15 referencias de productos a $2.000 COP la unidad

---

## Roles del sistema

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `admin` | Propietario del negocio. Supervisa operación, valida pedidos, gestiona usuarios | Dashboard, inventario, pedidos, usuarios |
| `operaria` | Registra lotes de producción y actualiza el inventario | Registro de producción, historial de lotes |
| `vendedor` | Atiende pedidos confirmados y gestiona entregas | Lista de pedidos activos, cambio de estados |
| `distribuidor` | Consulta catálogo y crea pedidos de forma autónoma | Catálogo, crear pedido, historial propio |

---

## Historias de usuario — estado actual

### Sprint 1 — COMPLETADO ✅
- **HU-1.1** Inicio de sesión con redirección por rol
- **HU-1.2** Gestión de usuarios por el administrador (crear, activar, desactivar, filtrar)

### Sprint 2 — EN PROGRESO 🔄
- **HU-2.1** ✅ Registro de lote de producción por la operaria
- **HU-2.2** 🔄 Visualización del inventario completo por el administrador
- **HU-2.3** 🔄 Gestión del catálogo de productos por el administrador

### Sprint 3 — PENDIENTE
- **HU-3.1** Catálogo de productos disponibles para el distribuidor
- **HU-3.2** Creación de pedido con carrito y validación de stock

### Sprint 4 — PENDIENTE
- **HU-3.3** Historial de pedidos del distribuidor
- **HU-3.4** Vista de pedidos activos para el vendedor/repartidor
- **HU-3.5** Actualización de estado del pedido por el vendedor

### Sprint 5 — PENDIENTE
- **HU-4.1** Dashboard de resumen operativo para el administrador

### Sprint 6 — PENDIENTE
- **HU-5.1** Pruebas de integración, ajustes finales y despliegue

---

## Colecciones de Firestore

### `usuarios`
```
{
  nombre: string,
  email: string,
  rol: "admin" | "operaria" | "vendedor" | "distribuidor",
  activo: boolean
}
```
> El ID del documento es el UID de Firebase Auth.

### `productos`
```
{
  nombre: string,              // Ej: "Mora", "Vainilla con Arequipe"
  referencia: string,          // Ej: "CB-009"
  sabor: string,
  presentacion: "Vaso",        // Único formato actual
  precioUnitario: 2000,        // COP, fijo para todos los productos
  stockDisponible: number,
  estado: "disponible" | "agotado" | "en_produccion",
  umbralMinimo: 20,            // Alerta de stock bajo
  ultimaActualizacion: string  // ISO string
}
```

### `lotes_produccion`
```
{
  productoId: string,
  productoNombre: string,
  productoRef: string,
  cantidadProducida: number,
  operariaId: string,
  operariaNombre: string,
  observaciones: string,
  fechaRegistro: Timestamp     // serverTimestamp()
}
```

### `pedidos` (próxima implementación)
```
{
  distribuidorId: string,
  distribuidorNombre: string,
  fechaPedido: Timestamp,
  fechaEntregaSolicitada: string,
  estado: "pendiente" | "confirmado" | "en_preparacion" | "enviado" | "entregado",
  productos: [{ productoId, nombre, referencia, cantidad, precioUnitario }],
  totalPedido: number,
  formaPago: "efectivo" | "transferencia",
  direccionEntrega: string,
  observaciones: string
}
```

---

## Reglas de negocio críticas

1. **Reserva de stock:** Al confirmar un pedido, el stock se descuenta inmediatamente con una transacción atómica (`runTransaction`) para evitar sobreventas.
2. **Cambio de estado de producto:** Si `stockDisponible > 0` el estado debe ser `"disponible"`. Si llega a 0 debe pasar a `"agotado"`. El cambio a `"en_produccion"` solo lo hace el administrador manualmente.
3. **Estado de pedidos:** El flujo es unidireccional — nunca retrocede: `pendiente → confirmado → en_preparacion → enviado → entregado`.
4. **Privacidad entre distribuidores:** Un distribuidor solo puede ver sus propios pedidos. Nunca el historial de otros distribuidores.
5. **Fecha mínima de entrega:** Los pedidos deben solicitarse con mínimo 2 días de anticipación.
6. **Umbral de stock bajo:** Cuando `stockDisponible < umbralMinimo` el sistema debe mostrar alerta visual al administrador.

---

## Páginas del sistema

| Archivo | Rol que accede | Descripción |
|---------|---------------|-------------|
| `pages/login.html` | Todos | Inicio de sesión |
| `pages/dashboard.html` | admin | Panel de resumen operativo |
| `pages/usuarios.html` | admin | Gestión de usuarios |
| `pages/inventario.html` | admin | Vista completa del inventario |
| `pages/produccion.html` | operaria, admin | Registro de lotes |
| `pages/pedidos.html` | vendedor, admin | Gestión de pedidos activos |
| `pages/catalogo.html` | distribuidor | Catálogo y creación de pedidos |

---

## Restricciones del proyecto

- Sin pasarelas de pago en línea
- Sin app móvil nativa (solo web responsive)
- Sin integraciones con sistemas contables externos
- Sin migración de datos históricos de Google Sheets
- Presupuesto: solo herramientas gratuitas (Firebase plan Spark)
- Tiempo: entrega final 18 de mayo de 2026
