import { useState } from "react";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import {
  UserPlus,
  X,
  QrCode,
  Download,
  GraduationCap,
  Users
} from "lucide-react";
import QRCode from "qrcode";

export default function FormularioRegistro({ onClose }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [facultad, setFacultad] = useState("");
  const [escuela, setEscuela] = useState("");
  const [curso, setCurso] = useState("");
  const [tipo, setTipo] = useState("alumno");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const registrar = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!codigo || !nombre || !facultad || !escuela || !curso || !tipo) {
      setMensaje("⚠️ Completa todos los campos");
      return;
    }

    try {
      setCargando(true);

      // Primero crear el documento del estudiante
      const docRef = await addDoc(collection(db, "estudiantes"), {
        codigo,
        nombre,
        facultad,
        escuela,
        curso,
        tipo,
        fechaCreacion: new Date(),
      });

      // Generar el QR con el código del estudiante
      const dataUrl = await QRCode.toDataURL(codigo, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300, // Aumenté el tamaño para mejor calidad
        color: { dark: "#0f172a", light: "#ffffff" },
      });

      // Actualizar el documento con la imagen QR en base64
      await updateDoc(doc(db, "estudiantes", docRef.id), {
        qrImage: dataUrl, // Guardar la imagen como base64
        qrGenerado: true,
        fechaQR: new Date()
      });

      const payload = {
        uid: docRef.id,
        codigo,
        nombre,
        facultad,
        escuela,
        curso,
        tipo,
        v: 1,
      };

      setQrPayload(payload);
      setQrDataUrl(dataUrl);
      setMensaje("✅ Estudiante registrado y QR guardado. Código generado abajo.");
      
      // Limpiar formulario
      setCodigo("");
      setNombre("");
      setFacultad("");
      setEscuela("");
      setCurso("");
      setTipo("alumno");
    } catch (error) {
      console.error("Error al registrar:", error);
      setMensaje("❌ No se pudo registrar el estudiante");
    } finally {
      setCargando(false);
    }
  };

  const descargarQR = () => {
    if (!qrDataUrl || !qrPayload) return;
    
    // Crear un enlace de descarga
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR_${qrPayload.codigo}_${qrPayload.nombre.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const regenerarQR = async () => {
    if (!qrPayload) return;
    
    try {
      setCargando(true);
      setMensaje("🔄 Regenerando código QR...");
      
      // Generar nuevo QR
      const nuevoDataUrl = await QRCode.toDataURL(qrPayload.codigo, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
        color: { dark: "#0f172a", light: "#ffffff" },
      });

      // Actualizar en la base de datos
      await updateDoc(doc(db, "estudiantes", qrPayload.uid), {
        qrImage: nuevoDataUrl,
        fechaQR: new Date()
      });

      setQrDataUrl(nuevoDataUrl);
      setMensaje("✅ Código QR regenerado y actualizado");
    } catch (error) {
      console.error("Error al regenerar QR:", error);
      setMensaje("❌ Error al regenerar el código QR");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-6">
      {!qrDataUrl && (
        <form
          onSubmit={registrar}
          className="space-y-6 bg-white p-6 rounded-xl shadow-lg border border-gray-200"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-sky-900 flex items-center gap-2">
              <UserPlus size={22} className="text-sky-700" />
              Datos del estudiante
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código USS *
              </label>
              <input
                type="text"
                placeholder="Ej: U20123456"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.trim())}
                className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo *
              </label>
              <input
                type="text"
                placeholder="Nombre completo del estudiante"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facultad *
              </label>
              <input
                type="text"
                placeholder="Ej: Facultad de Ingeniería"
                value={facultad}
                onChange={(e) => setFacultad(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Escuela *
              </label>
              <input
                type="text"
                placeholder="Ej: Escuela de Ingeniería de Sistemas"
                value={escuela}
                onChange={(e) => setEscuela(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Curso *
              </label>
              <input
                type="text"
                placeholder="Ej: Algoritmos y Programación"
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de participante *
              </label>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-gray-50">
                  <input
                    type="radio"
                    value="alumno"
                    checked={tipo === "alumno"}
                    onChange={(e) => setTipo(e.target.value)}
                    className="accent-sky-600"
                  />
                  <GraduationCap size={18} className="text-sky-700" />
                  <span className="text-sm text-gray-700">Alumno USS</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-gray-50">
                  <input
                    type="radio"
                    value="externo"
                    checked={tipo === "externo"}
                    onChange={(e) => setTipo(e.target.value)}
                    className="accent-sky-600"
                  />
                  <Users size={18} className="text-gray-600" />
                  <span className="text-sm text-gray-700">Externo</span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className={`w-full py-3 rounded-md font-semibold text-white transition-colors ${
              cargando ? "bg-sky-400 cursor-not-allowed" : "bg-sky-700 hover:bg-sky-800"
            }`}
          >
            {cargando ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Registrando...
              </div>
            ) : (
              "Registrar estudiante"
            )}
          </button>

          {mensaje && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-center text-blue-800">{mensaje}</p>
            </div>
          )}
        </form>
      )}

      {qrPayload && qrDataUrl && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-2 mb-6">
            <QrCode size={20} className="text-sky-700" />
            <h3 className="text-lg font-semibold text-sky-900">
              Código QR generado
            </h3>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <img
                src={qrDataUrl}
                alt={`QR de ${qrPayload.nombre}`}
                className="w-[250px] h-[250px] rounded-md"
              />
            </div>
            
            <div className="text-center">
              <h4 className="font-semibold text-gray-800 text-lg">
                {qrPayload.nombre}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Código:</strong> {qrPayload.codigo}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Curso:</strong> {qrPayload.curso}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Facultad:</strong> {qrPayload.facultad}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Escuela:</strong> {qrPayload.escuela}
              </p>
              
              {qrPayload.tipo === "externo" ? (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-2 px-2 py-1 bg-gray-100 rounded-full">
                  <Users size={12} /> Participante Externo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-sky-700 mt-2 px-2 py-1 bg-sky-100 rounded-full">
                  <GraduationCap size={12} /> Alumno USS
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={descargarQR}
                className="flex items-center gap-2 bg-sky-700 text-white px-4 py-2 rounded-md hover:bg-sky-800 transition-colors"
              >
                <Download size={18} />
                Descargar QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}