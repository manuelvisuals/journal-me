"use client";

// Guscio: la pagina e del modulo ADMIN, la schermata vive in
// src/modules/admin/components/admin-client.tsx. Chi non e admin non vede
// niente: il controllo vero sta sulla rotta (src/modules/admin/server.ts).
import { AdminClient } from "@/modules/admin/components/admin-client";

export default function AdminPage() {
  return <AdminClient />;
}
