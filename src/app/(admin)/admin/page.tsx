"use client";

// Guscio: la pagina e del modulo ADMIN, la schermata vive in
// src/modules/admin/components/admin-client.tsx. Dal 13 settembre 2026 sta
// nel gruppo `(admin)`, fuori dal guscio dell'app (vedi ../layout.tsx).
import { AdminClient } from "@/modules/admin/components/admin-client";

export default function AdminPage() {
  return <AdminClient />;
}
