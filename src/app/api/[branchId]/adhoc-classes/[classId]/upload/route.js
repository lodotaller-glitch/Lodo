import dbConnect from "@/lib/dbConnect";
import { Attendance, User } from "@/models";
import AdhocClass from "@/models/AdhocClass";
import { NextResponse } from "next/server";

import * as XLSX from "xlsx";

export async function POST(req, { params }) {
  await dbConnect();
  const { branchId, classId } = await params;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json(
        { error: "No se envió ningún archivo" },
        { status: 400 }
      );
    }

    // Leer el archivo XLSX
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const emails = rows.map((r) => r.Gmail?.trim()).filter(Boolean);
    if (emails.length === 0)
      return NextResponse.json(
        { error: "No se encontraron emails válidos" },
        { status: 400 }
      );

    const adhocClass = await AdhocClass.findById(classId).populate("professor");
    if (!adhocClass)
      return NextResponse.json(
        { error: "Clase no encontrada" },
        { status: 404 }
      );

    const users = await User.find({ email: { $in: emails }, branch: branchId });
    const foundEmails = users.map((u) => u.email);

    const missing = emails.filter((e) => !foundEmails.includes(e));
    const created = [];
    // Crear fecha con día y hora reales
    // const classDate = new Date(adhocClass.date);
    // classDate.setHours(hours, minutes, 0, 0);

    const baseDate = new Date(adhocClass.date);
    const classDate = new Date(
      Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth(),
        baseDate.getUTCDate(),
        Math.floor(adhocClass.slotSnapshot.startMin / 60),
        adhocClass.slotSnapshot.startMin % 60,
        0,
        0
      )
    );

    for (const user of users) {
      try {
        await Attendance.findOneAndUpdate(
          {
            student: user._id,
            professor: adhocClass.professor._id,
            branch: adhocClass.branch,
            date: classDate,
            origin: "adhoc",
          },
          {
            $set: {
              student: user._id,
              professor: adhocClass.professor._id,
              branch: adhocClass.branch,
              date: classDate,
              origin: "adhoc",
              removed: false,
              status: "ausente",
              adhocClass: adhocClass._id,
              slotSnapshot: adhocClass.slotSnapshot,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        created.push(user.email);
      } catch (err) {
        console.warn("Error creando asistencia para", user.email, err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      total: emails.length,
      creados: created.length,
      noEncontrados: missing,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error procesando el archivo" },
      { status: 500 }
    );
  }
}
