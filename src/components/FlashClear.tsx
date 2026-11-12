"use client";
import { useEffect } from "react";

export function FlashClear() {
  useEffect(() => { void fetch("/api/flash", { method: "DELETE" }); }, []);
  return null;
}
