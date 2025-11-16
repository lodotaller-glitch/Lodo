// app/api/[branchId]/classes/disable/route.js
import dbConnect from "@/lib/dbConnect";
import { DisabledClass } from "@/models";

export async function PATCH(req) {
  await dbConnect();
  const { start, slot, enrollmentId } = await req.json();

  if (!start || !slot || !enrollmentId) {
    return Response.json(
      { error: "Falta start, slot o enrollmentId" },
      { status: 400 }
    );
  }

  const key = `${start}_${slot}`;

  // Buscar si ya existe la clase deshabilitada
  const existing = await DisabledClass.findOne({ key });

  if (existing) {
    // Si existe, habilitar → eliminar registro
    await DisabledClass.deleteOne({ key });
    return Response.json({ ok: true, disabled: false });
  } else {
    // Si no existe, deshabilitar → crear registro
    await DisabledClass.updateOne(
      { key },
      { enrollmentId, start, slot },
      { upsert: true }
    );
    return Response.json({ ok: true, disabled: true });
  }
}
