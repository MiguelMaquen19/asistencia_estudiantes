import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { UserPlus, X, Trash2, Edit } from "lucide-react";

export default function FormularioDocente({ selectedTheme = "blue", themes = {} }) {
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [docentes, setDocentes] = useState([]);

  // modal
  const [showModal, setShowModal] = useState(false);

  // edición
  const [editandoId, setEditandoId] = useState(null);

  // confirmación eliminación
  const [docenteAEliminar, setDocenteAEliminar] = useState(null);

  const themeStyles = themes[selectedTheme] || {
    primary: "#1E3A8A",
    secondary: "#3B82F6",
    background: "#F0F4F8",
    textPrimary: "#111827",
    textSecondary: "#4B5563",
  };

  // carga en tiempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "docentes"), (snapshot) => {
      const listaDocentes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDocentes(listaDocentes);
    });

    return () => unsubscribe();
  }, []);

  // abrir modal en modo agregar
  const abrirModalAgregar = () => {
    setEditandoId(null);
    setDni("");
    setNombre("");
    setMensaje("");
    setShowModal(true);
  };

  // abrir modal en modo edición
  const abrirModalEditar = (docente) => {
    setEditandoId(docente.id);
    setDni(docente.dni);
    setNombre(docente.nombre);
    setMensaje("");
    setShowModal(true);
  };

  // registrar o actualizar
  const manejarSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!dni || dni.length !== 8 || !nombre) {
      setMensaje("⚠️ Completa DNI (8 dígitos) y nombre");
      return;
    }

    try {
      setCargando(true);

      if (editandoId) {
        // actualizar
        const ref = doc(db, "docentes", editandoId);
        await updateDoc(ref, { dni, nombre });
        setMensaje("✅ Docente actualizado correctamente.");
      } else {
        // registrar nuevo
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
          timestamp: new Date().toISOString(),
        });
        setMensaje("✅ Docente registrado exitosamente.");
      }

      setShowModal(false);
      setDni("");
      setNombre("");
      setEditandoId(null);
    } catch (error) {
      console.error("Error al guardar docente:", error);
      setMensaje("❌ Error al guardar.");
    } finally {
      setCargando(false);
    }
  };

  // eliminar docente
  const eliminarDocente = async () => {
    try {
      await deleteDoc(doc(db, "docentes", docenteAEliminar.id));
      setMensaje("✅ Docente eliminado correctamente.");
      setDocenteAEliminar(null);
    } catch (error) {
      console.error("Error al eliminar docente:", error);
      setMensaje("❌ No se pudo eliminar.");
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Tabla de docentes */}
      <div className="p-4 rounded-xl shadow-lg border bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3
            className="text-lg font-semibold"
            style={{ color: themeStyles.primary }}
          >
            Docentes Registrados
          </h3>
          <button
            onClick={abrirModalAgregar}
            className="flex items-center gap-2 text-white px-4 py-2 rounded shadow"
            style={{ backgroundColor: themeStyles.primary }}
          >
            <UserPlus size={20} />
            Agregar Docente
          </button>
        </div>
        {docentes.length === 0 ? (
          <p className="text-sm italic">No hay docentes registrados aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: themeStyles.secondary }}>
                  <th className="p-2 text-white">Nombre</th>
                  <th className="p-2 text-white">DNI</th>
                  <th className="p-2 text-white">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {docentes.map((docente) => (
                  <tr key={docente.id} className="border-b">
                    <td className="p-2">{docente.nombre}</td>
                    <td className="p-2">{docente.dni}</td>
                    <td className="p-2 flex gap-2">
                      <button
                        onClick={() => abrirModalEditar(docente)}
                        className="p-1"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setDocenteAEliminar(docente)}
                        className="p-1"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Agregar/Editar */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <form
            onSubmit={manejarSubmit}
            className="space-y-6 p-6 rounded-xl border bg-white shadow-lg w-[450px]"
          >
            <div className="flex justify-between items-center">
              <h2
                className="text-xl font-bold flex items-center gap-2"
                style={{ color: themeStyles.primary }}
              >
                {editandoId ? "✏️ Editar Docente" : "➕ Agregar Docente"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            {mensaje && <p className="text-sm text-center italic">{mensaje}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="DNI (8 dígitos)"
                value={dni}
                onChange={(e) =>
                  setDni(e.target.value.replace(/[^0-9]/g, ""))
                }
                maxLength={8}
                className="border rounded-md p-2"
              />
              <input
                type="text"
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="border rounded-md p-2"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-md border"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="px-4 py-2 rounded-md font-semibold text-white"
                style={{ backgroundColor: themeStyles.primary }}
              >
                {editandoId ? "Actualizar Docente" : "Agregar Docente"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Confirmación Eliminar */}
      {docenteAEliminar && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                🗑️ Eliminar Docente
              </h2>
              <button onClick={() => setDocenteAEliminar(null)}>
                <X size={20} />
              </button>
            </div>
            <p className="mb-3">
              ¿Estás seguro que deseas eliminar al docente?
            </p>
            <div className="bg-gray-100 p-3 rounded-md mb-3">
              <p className="font-semibold">{docenteAEliminar.nombre}</p>
              <p className="text-sm text-gray-600">
                DNI: {docenteAEliminar.dni}
              </p>
            </div>
            <p className="text-xs text-yellow-600 mb-4">
              ⚠️ Esta acción no se puede deshacer
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDocenteAEliminar(null)}
                className="px-4 py-2 rounded-md border"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarDocente}
                className="px-4 py-2 rounded-md text-white"
                style={{ backgroundColor: "red" }}
              >
                Eliminar Docente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
