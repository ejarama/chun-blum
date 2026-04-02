import * as dotenv from "dotenv";
dotenv.config();

import { initializeApp } from "firebase/app";
import { getFirestore, collection, writeBatch, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.FIREBASE_PROJECT_ID,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const productos = [
  { nombre: "Milo",                    referencia: "CB-001", sabor: "Milo",                   presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Queso Arequipe",          referencia: "CB-002", sabor: "Queso Arequipe",          presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Queso Bocadillo",         referencia: "CB-003", sabor: "Queso Bocadillo",         presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Oreo",                    referencia: "CB-004", sabor: "Oreo",                    presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Café Arequipe",           referencia: "CB-005", sabor: "Café Arequipe",           presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Breva Arequipe",          referencia: "CB-006", sabor: "Breva Arequipe",          presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Coco",                    referencia: "CB-007", sabor: "Coco",                    presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Queso",                   referencia: "CB-008", sabor: "Queso",                   presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Mora",                    referencia: "CB-009", sabor: "Mora",                    presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Vainilla",                referencia: "CB-010", sabor: "Vainilla",                presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Vainilla con Arequipe",   referencia: "CB-011", sabor: "Vainilla con Arequipe",   presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Vainilla con Bocadillo",  referencia: "CB-012", sabor: "Vainilla con Bocadillo",  presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Maní Arequipe",           referencia: "CB-013", sabor: "Maní Arequipe",           presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Mora Refrescante",        referencia: "CB-014", sabor: "Mora Refrescante",        presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
  { nombre: "Maracumango Refrescante", referencia: "CB-015", sabor: "Maracumango Refrescante", presentacion: "Vaso", precioUnitario: 2000, stockDisponible: 0, estado: "agotado", umbralMinimo: 20 },
];

async function seedProductos() {
  try {
    const batch  = writeBatch(db);
    const colRef = collection(db, "productos");

    productos.forEach(producto => {
      const docRef = doc(colRef);
      batch.set(docRef, {
        ...producto,
        ultimaActualizacion: new Date().toISOString(),
      });
    });

    await batch.commit();
    console.log(`✅ ${productos.length} productos creados exitosamente en Firestore`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al crear productos:", error);
    process.exit(1);
  }
}

seedProductos();