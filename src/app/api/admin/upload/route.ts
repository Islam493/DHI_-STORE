import { NextResponse } from "next/server";
import { uploadImage } from "@/lib/db";
import { fail, guard } from "@/lib/admin-api";

export async function POST(req: Request) {
  const g = await guard(["products.edit", "reviews.edit"]); if (g) return g;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "ما كانش صورة" }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "الصورة لازم تكون JPG ولا PNG ولا WEBP" }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "الصورة كبيرة بزاف (أكثر من 4MB)" }, { status: 400 });
    const name = (file as File).name || "image.jpg";
    return NextResponse.json({ url: await uploadImage(file, name) });
  } catch (e) { return fail(e); }
}
