import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { UserPlus, X } from "lucide-react";

export default function FormularioDocente({ showFormAsModal, onClose, onOpenModal }) {
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [docentes, setDocentes] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "docentes"), (snapshot) => {
      const listaDocentes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDocentes(listaDocentes);
    }, (error) => {
      console.error("Error al obtener docentes:", error);
      setMensaje("❌ Error al cargar la lista de docentes.");
    });

    return () => unsubscribe();
  }, []);

  const registrarDocente = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!dni || dni.length !== 8 || !nombre) {
      setMensaje("⚠️ Completa DNI (8 dígitos) y nombre");
      return;
    }

    try {
      setCargando(true);

      const q = query(collection(db, "docentes"), where("dni", "==", dni));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setMensaje("❌ Este DNI ya está registrado.");
        setCargando(false);
        return;
      }

      await addDoc(collection(db, "docentes"), {
        dni,
        nombre,
        rol: "docente",
        timestamp: new Date().toISOString()
      });

      setMensaje("✅ Docente registrado exitosamente. La colección 'docentes' se creó si no existía.");
      setDni("");
      setNombre("");
      if (showFormAsModal) {
        onClose();
      }
    } catch (error) {
      console.error("Error al registrar docente:", error);
      if (error.code === "permission-denied") {
        setMensaje("❌ No tienes permiso para crear la colección. Revisa las reglas de Firestore.");
      } else {
        setMensaje("❌ No se pudo registrar. Verifica tu conexión o intenta de nuevo.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className={showFormAsModal ? "space-y-6" : "space-y-6 w-full"}>
      {showFormAsModal ? (
        <form
          onSubmit={registrarDocente}
          className="space-y-6 bg-white p-6 rounded-xl border border-gray-200"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-sky-900 flex items-center gap-2">
              <UserPlus size={22} className="text-sky-700" />
              Agregar Docente
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="DNI (8 dígitos)"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={8}
              className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="text"
              placeholder="Nombre completo del docente"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className={`px-4 py-2 rounded-md font-semibold text-white ${
                cargando ? "bg-sky-400" : "bg-sky-700 hover:bg-sky-800"
              }`}
            >
              {cargando ? "Registrando..." : "Agregar Docente"}
            </button>
          </div>

          {mensaje && (
            <p className="text-sm text-center mt-2 text-gray-600 italic">{mensaje}</p>
          )}
        </form>
      ) : (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-sky-900">Docentes Registrados</h3>
            <button
              onClick={onOpenModal}
              className="flex items-center gap-2 bg-sky-700 text-white px-4 py-2 rounded shadow hover:bg-sky-800 transition"
            >
              <UserPlus size={20} />
              Agregar Docente
            </button>
          </div>
          {docentes.length === 0 ? (
            <p className="text-sm text-gray-600 italic">No hay docentes registrados aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-sky-100">
                    <th className="text-left p-2 text-sm font-semibold text-sky-800 border-b">Nombre</th>
                    <th className="text-left p-2 text-sm font-semibold text-sky-800 border-b">DNI</th>
                  </tr>
                </thead>
                <tbody>
                  {docentes.map((docente) => (
                    <tr key={docente.id} className="bg-gray-50 hover:bg-gray-100 border-b">
                      <td className="p-2 text-sm text-sky-800">{docente.nombre}</td>
                      <td className="p-2 text-sm text-sky-800">{docente.dni}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}