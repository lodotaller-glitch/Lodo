"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, use } from "react";
import { useAuth } from "@/context/AuthContext";

export default function MiClasePage({ searchParams }) {
  const { start, profesorId } = use(searchParams);

  const [qrValue, setQrValue] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef(null);
  const scanRef = useRef(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!("BarcodeDetector" in window)) {
      alert("BarcodeDetector no soportado");
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      if (codes[0]) {
        setQrValue(codes[0].rawValue || "");
        // TODO: enviar asistencia al servidor
      } else {
        alert("No se detectó código");
      }
    } catch (err) {
      console.error(err);
      alert("Error leyendo QR");
    }
  }

  async function startCamera() {
    if (!("BarcodeDetector" in window)) {
      alert("BarcodeDetector no soportado");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      scan();
    } catch (err) {
      console.error(err);
      alert("No se pudo abrir la cámara");
    }
  }

  async function scan() {
    if (!videoRef.current) return;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    try {
      const codes = await detector.detect(videoRef.current);
      if (codes[0]) {
        setQrValue(codes[0].rawValue || "");
        stopCamera();
        // TODO: enviar asistencia al servidor
        return;
      }
    } catch (err) {
      console.error(err);
    }
    scanRef.current = requestAnimationFrame(scan);
  }

  function stopCamera() {
    setScanning(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (scanRef.current) cancelAnimationFrame(scanRef.current);
  }

  function handleReschedule() {
    if (user && start && profesorId) {
      router.push(
        `/student/my-class/reschedule?start=${encodeURIComponent(
          start
        )}&profesorId=${profesorId}`
      );
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Clase</h1>
        {start && (
          <p className="text-sm text-gray-600">
            {new Date(start).toLocaleString()}
          </p>
        )}
      </div>

      <section className="bg-white p-4 rounded-2xl shadow space-y-3">
        <h2 className="font-medium">Marcar asistencia</h2>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={startCamera}
          className="px-3 py-2 rounded-xl text-white"
          style={{ background: "#A08775" }}
        >
          Usar cámara
        </button>
        {scanning && <video ref={videoRef} className="w-full aspect-square" />}
        {qrValue && <p className="text-sm">Código: {qrValue}</p>}
      </section>

      <button
        onClick={handleReschedule}
        className="px-4 py-2 rounded-xl text-white"
        style={{ background: "#A08775" }}
      >
        Reprogramar clase
      </button>
    </main>
  );
}
