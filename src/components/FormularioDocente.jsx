import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, where, onSnapshot, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { UserPlus, X, Trash2, Edit } from "lucide-react";

export default function FormularioDocente({ 
  showFormAsModal, 
  onClose, 
  onOpenModal, 
  selectedTheme = 'blue', 
  themes = {} 
}) {
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [docentes, setDocentes] = useState([]);
  const [editandoDocente, setEditandoDocente] = useState(null);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [docenteAEliminar, setDocenteAEliminar] = useState(null);

  // Use the themes object to get the styles for the selected theme, with a fallback
  const themeStyles = themes[selectedTheme] || { 
    primary: '#1E3A8A',
    secondary: '#3B82F6',
    background: '#F0F4F8',
    textPrimary: '#111827',
    textSecondary: '#4B5563',
  };

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

  const abrirModalEditar = (docente) => {
    setEditandoDocente(docente);
    setDni(docente.dni);
    setNombre(docente.nombre);
    setMostrarModalEditar(true);
    setMensaje("");
  };

  const cerrarModalEditar = () => {
    setMostrarModalEditar(false);
    setEditandoDocente(null);
    setDni("");
    setNombre("");
    setMensaje("");
  };

  const actualizarDocente = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!dni || dni.length !== 8 || !nombre) {
      setMensaje("⚠️ Completa DNI (8 dígitos) y nombre");
      return;
    }

    try {
      setCargando(true);

      // Verificar si el DNI ya existe en otro docente
      const q = query(collection(db, "docentes"), where("dni", "==", dni));
      const snapshot = await getDocs(q);
      const docenteExistente = snapshot.docs.find(doc => doc.id !== editandoDocente.id);
      
      if (docenteExistente) {
        setMensaje("❌ Este DNI ya está registrado en otro docente.");
        setCargando(false);
        return;
      }

      await updateDoc(doc(db, "docentes", editandoDocente.id), {
        dni,
        nombre,
        timestamp: new Date().toISOString()
      });

      setMensaje("✅ Docente actualizado exitosamente.");
      cerrarModalEditar();
    } catch (error) {
      console.error("Error al actualizar docente:", error);
      setMensaje("❌ No se pudo actualizar. Verifica tu conexión o intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const abrirModalEliminar = (docente) => {
    setDocenteAEliminar(docente);
    setMostrarModalEliminar(true);
  };

  const cerrarModalEliminar = () => {
    setMostrarModalEliminar(false);
    setDocenteAEliminar(null);
  };

  const eliminarDocente = async () => {
    try {
      setCargando(true);
      await deleteDoc(doc(db, "docentes", docenteAEliminar.id));
      setMensaje("✅ Docente eliminado exitosamente.");
      cerrarModalEliminar();
    } catch (error) {
      console.error("Error al eliminar docente:", error);
      setMensaje("❌ No se pudo eliminar. Verifica tu conexión o intenta de nuevo.");
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
          style={{ borderColor: themeStyles.textSecondary }}
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: themeStyles.primary }}>
              <UserPlus size={22} style={{ color: themeStyles.secondary }} />
              Agregar Docente
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {mensaje && (
            <p className="text-sm text-center italic" style={{ color: themeStyles.textSecondary }}>{mensaje}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="DNI (8 dígitos)"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={8}
              className="border rounded-md p-2 focus:ring-2 focus:outline-none"
              style={{ borderColor: themeStyles.textSecondary, color: themeStyles.textPrimary, focusRingColor: themeStyles.secondary }}
            />
            <input
              type="text"
              placeholder="Nombre completo del docente"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="border rounded-md p-2 focus:ring-2 focus:outline-none"
              style={{ borderColor: themeStyles.textSecondary, color: themeStyles.textPrimary, focusRingColor: themeStyles.secondary }}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md hover:bg-gray-100 transition"
              style={{ color: themeStyles.textPrimary }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className={`px-4 py-2 rounded-md font-semibold text-white transition-all duration-200`}
              style={{ backgroundColor: cargando ? themeStyles.secondary : themeStyles.primary }}
            >
              {cargando ? "Registrando..." : "Agregar Docente"}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200" style={{ borderColor: themeStyles.textSecondary }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold" style={{ color: themeStyles.primary }}>Docentes Registrados</h3>
            <button
              onClick={onOpenModal}
              className="flex items-center gap-2 text-white px-4 py-2 rounded shadow transition-all duration-200"
              style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF', hoverBgColor: themeStyles.secondary }}
            >
              <UserPlus size={20} />
              Agregar Docente
            </button>
          </div>
          {docentes.length === 0 ? (
            <p className="text-sm italic" style={{ color: themeStyles.textSecondary }}>No hay docentes registrados aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: themeStyles.secondary }}>
                    <th className="text-left p-2 text-sm font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF' }}>Nombre</th>
                    <th className="text-left p-2 text-sm font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF' }}>DNI</th>
                    <th className="text-left p-2 text-sm font-semibold uppercase tracking-wider" style={{ color: '#FFFFFF' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docentes.map((docente) => (
                    <tr key={docente.id} className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: themeStyles.textSecondary }}>
                      <td className="p-2 text-sm" style={{ color: themeStyles.textPrimary }}>{docente.nombre}</td>
                      <td className="p-2 text-sm" style={{ color: themeStyles.textPrimary }}>{docente.dni}</td>
                      <td className="p-2 text-sm flex gap-2">
                        <button
                          onClick={() => abrirModalEditar(docente)}
                          className="p-1 rounded-full text-gray-500 hover:text-green-600 transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => abrirModalEliminar(docente)}
                          className="p-1 rounded-full text-gray-500 hover:text-red-600 transition-colors"
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
      )}

      {/* Modal de Editar Docente */}
      {mostrarModalEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md" style={{ borderColor: themeStyles.textSecondary }}>
            <form onSubmit={actualizarDocente} className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: themeStyles.primary }}>
                  <Edit size={22} style={{ color: themeStyles.secondary }} />
                  Editar Docente
                </h2>
                <button
                  type="button"
                  onClick={cerrarModalEditar}
                  className="p-1 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {mensaje && (
                <p className="text-sm text-center italic" style={{ color: themeStyles.textSecondary }}>{mensaje}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="DNI (8 dígitos)"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={8}
                  className="border rounded-md p-2 focus:ring-2 focus:outline-none"
                  style={{ borderColor: themeStyles.textSecondary, color: themeStyles.textPrimary, focusRingColor: themeStyles.secondary }}
                />
                <input
                  type="text"
                  placeholder="Nombre completo del docente"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="border rounded-md p-2 focus:ring-2 focus:outline-none"
                  style={{ borderColor: themeStyles.textSecondary, color: themeStyles.textPrimary, focusRingColor: themeStyles.secondary }}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cerrarModalEditar}
                  className="px-4 py-2 rounded-md hover:bg-gray-100 transition"
                  style={{ color: themeStyles.textPrimary }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className={`px-4 py-2 rounded-md font-semibold text-white transition-all duration-200`}
                  style={{ backgroundColor: cargando ? themeStyles.secondary : themeStyles.primary }}
                >
                  {cargando ? "Actualizando..." : "Actualizar Docente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar */}
      {mostrarModalEliminar && docenteAEliminar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md" style={{ borderColor: themeStyles.textSecondary }}>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: themeStyles.primary }}>
                  <Trash2 size={22} style={{ color: '#DC2626' }} />
                  Eliminar Docente
                </h2>
                <button
                  type="button"
                  onClick={cerrarModalEliminar}
                  className="p-1 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm mb-2" style={{ color: themeStyles.textPrimary }}>
                  ¿Estás seguro de que deseas eliminar al docente?
                </p>
                <div className="bg-gray-50 p-3 rounded-md" style={{ backgroundColor: `${themeStyles.textSecondary}10` }}>
                  <p className="font-semibold" style={{ color: themeStyles.textPrimary }}>{docenteAEliminar.nombre}</p>
                  <p className="text-sm" style={{ color: themeStyles.textSecondary }}>DNI: {docenteAEliminar.dni}</p>
                </div>
                <p className="text-xs mt-2 text-red-600">
                  ⚠️ Esta acción no se puede deshacer
                </p>
              </div>

              {mensaje && (
                <p className="text-sm text-center italic" style={{ color: themeStyles.textSecondary }}>{mensaje}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cerrarModalEliminar}
                  className="px-4 py-2 rounded-md hover:bg-gray-100 transition"
                  style={{ color: themeStyles.textPrimary }}
                >
                  Cancelar
                </button>
                <button
                  onClick={eliminarDocente}
                  disabled={cargando}
                  className={`px-4 py-2 rounded-md font-semibold text-white transition-all duration-200`}
                  style={{ backgroundColor: cargando ? '#DC2626' : '#DC2626' }}
                >
                  {cargando ? "Eliminando..." : "Eliminar Docente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}