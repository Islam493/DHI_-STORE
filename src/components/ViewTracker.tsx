"use client";
import { useEffect } from "react";
import { track } from "@/lib/track";

export default function ViewTracker({ id, name, value }: { id: string; name: string; value: number }) {
  useEffect(() => { track("ViewContent", { id, name, value }); }, [id, name, value]);
  return null;
}
