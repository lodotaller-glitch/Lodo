import dbConnect from "@/lib/dbConnect";
import { User, Enrollment } from "@/models";

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase();
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const profesorId = searchParams.get("profesorId");

  if (!email) return Response.json({ error: "Falta email" }, { status: 400 });
  const est = await User.findOne({ email, role: "student" }).lean();

  if (!est) return Response.json({ enrollments: [] });
  const q = { student: est._id, state: "activa" };
  if (year) q.year = Number(year);
  if (month) q.month = Number(month);
  if (profesorId) q.profesor = profesorId;

  const items = await Enrollment.find(q).populate("professor", "name").lean();

  return Response.json({ enrollments: items });
}
