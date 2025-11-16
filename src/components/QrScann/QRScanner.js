"use client";
import { useRef, useState, useEffect } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

export default function QRScanner({
  onResult, // (raw: string) => Promise<void> | void
  onError, // (err: Error | string) => void
  videoClassName = "w-full bg-black rounded-lg",
  minHeight = 220,
  facingMode = "environment", // o "user"
}) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");

  async function startScanner() {
    setMsg("");
    if (!window.isSecureContext && location.hostname !== "localhost") {
      const m = "Necesitás HTTPS (o localhost).";
      setMsg(m);
      onError?.(m);
      return;
    }
    try {
      setScanning(true);
      await new Promise((r) => requestAnimationFrame(r)); // asegura <video> montado
      readerRef.current ||= new BrowserQRCodeReader();

      controlsRef.current = await readerRef.current.decodeFromConstraints(
        { video: { facingMode: { ideal: facingMode } }, audio: false },
        videoRef.current,
        async (result, err, controls) => {
          if (result) {
            try {
              controls.stop();
              controlsRef.current = null;
              setScanning(false);
              const raw = result.getText();
              await onResult?.(raw);
            } catch (e) {
              onError?.(e);
            }
          }
          // err: frames sin QR -> ignorar
        }
      );
    } catch (e) {
      setMsg("No se pudo abrir la cámara");
      onError?.(e);
      stopScanner();
    }
  }
  

  function stopScanner() {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => stopScanner(), []);

  return (
    <div className="space-y-3">
      {!scanning ? (
        <button
          onClick={startScanner}
          className="px-4 py-2 rounded-xl text-white"
          style={{ background: "#A08775" }}
        >
          Abrir cámara y escanear
        </button>
      ) : (
        <button
          onClick={stopScanner}
          className="px-4 py-2 rounded-xl text-white"
          style={{ background: "#b45309" }}
        >
          Detener
        </button>
      )}
      {!scanning ? null : (
        <div className="rounded-xl overflow-hidden border">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={videoClassName}
            style={{ minHeight }}
          />
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
