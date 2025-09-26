import { useEffect, useState } from "react";
import { collection, onSnapshot, updateDoc, doc, deleteDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { GraduationCap, Users, QrCode, Download, RefreshCw, Eye, EyeOff, Edit, Trash2, X } from "lucide-react";
import QRCodeGenerator from "qrcode";

export default function ListaEstudiantes({ selectedTheme, themes }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargandoQR, setCargandoQR] = useState({});
  const [qrExpandido, setQrExpandido] = useState({});
  
  // Estados para editar y eliminar
  const [editandoEstudiante, setEditandoEstudiante] = useState(null);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [estudianteAEliminar, setEstudianteAEliminar] = useState(null);
  const [cargando, setCargando] = useState(false);
  
  // Estados para el formulario de edición
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [facultad, setFacultad] = useState("");
  const [escuela, setEscuela] = useState("");
  const [curso, setCurso] = useState("");
  const [tipo, setTipo] = useState("alumno");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "estudiantes"), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEstudiantes(lista);
    });
    return () => unsubscribe();
  }, []);

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 3000);
  };

  const descargarQR = (estudiante) => {
    const qrImage = estudiante.qrImage || estudiante.qrDataUrl;

    if (!qrImage) {
      mostrarMensaje("No hay QR disponible para este estudiante.");
      return;
    }

    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `QR_${estudiante.codigo}_${estudiante.nombre.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    mostrarMensaje(`QR de ${estudiante.nombre} descargado correctamente`);
  };

  const generarQR = async (estudiante) => {
    try {
      setCargandoQR((prev) => ({ ...prev, [estudiante.id]: true }));
      mostrarMensaje("Generando código QR...");

      const qrDataUrl = await QRCodeGenerator.toDataURL(estudiante.codigo, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
        // Adaptación de color para el tema
        color: { dark: themes[selectedTheme].primary, light: "#ffffff" },
      });

      await updateDoc(doc(db, "estudiantes", estudiante.id), {
        qrImage: qrDataUrl,
        qrGenerado: true,
        fechaQR: new Date(),
      });

      mostrarMensaje(`Código QR generado para ${estudiante.nombre}`);
    } catch (error) {
      console.error("Error al generar QR:", error);
      mostrarMensaje("Error al generar el código QR");
    } finally {
      setCargandoQR((prev) => ({ ...prev, [estudiante.id]: false }));
    }
  };

  const regenerarQR = async (estudiante) => {
    try {
      setCargandoQR((prev) => ({ ...prev, [estudiante.id]: true }));
      mostrarMensaje("Regenerando código QR...");

      const qrDataUrl = await QRCodeGenerator.toDataURL(estudiante.codigo, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
        // Adaptación de color para el tema
        color: { dark: themes[selectedTheme].primary, light: "#ffffff" },
      });

      await updateDoc(doc(db, "estudiantes", estudiante.id), {
        qrImage: qrDataUrl,
        fechaQR: new Date(),
      });

      mostrarMensaje(`Código QR regenerado para ${estudiante.nombre}`);
    } catch (error) {
      console.error("Error al regenerar QR:", error);
      mostrarMensaje("Error al regenerar el código QR");
    } finally {
      setCargandoQR((prev) => ({ ...prev, [estudiante.id]: false }));
    }
  };

  const toggleQR = (estudianteId) => {
    setQrExpandido((prev) => ({
      ...prev,
      [estudianteId]: !prev[estudianteId],
    }));
  };

  // Función para normalizar texto (eliminar acentos, espacios extra, convertir a minúsculas)
  const normalizarTexto = (texto) => {
    return texto
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/\s+/g, ' '); // Espacios múltiples a uno solo
  };

  // Verificar si ya existe un estudiante con el mismo código o nombre
  const verificarDuplicados = async (codigo, nombre, estudianteId = null) => {
    try {
      const codigoNormalizado = normalizarTexto(codigo);
      const nombreNormalizado = normalizarTexto(nombre);

      // Buscar por código exacto (más estricto)
      const queryPorCodigo = query(
        collection(db, "estudiantes"),
        where("codigo", "==", codigo.trim().toUpperCase())
      );
      const resultadosCodigo = await getDocs(queryPorCodigo);

      if (!resultadosCodigo.empty) {
        const estudianteExistente = resultadosCodigo.docs.find(doc => doc.id !== estudianteId);
        if (estudianteExistente) {
          return {
            duplicado: true,
            tipo: 'codigo',
            mensaje: `Ya existe un estudiante con el código: ${codigo}`
          };
        }
      }

      // Buscar por nombre (normalizado para evitar duplicados por mayúsculas/acentos)
      const queryTodos = query(collection(db, "estudiantes"));
      const todosLosEstudiantes = await getDocs(queryTodos);
      
      for (const doc of todosLosEstudiantes.docs) {
        if (doc.id === estudianteId) continue; // Saltar el estudiante actual
        const estudiante = doc.data();
        const nombreExistenteNormalizado = normalizarTexto(estudiante.nombre);
        
        if (nombreExistenteNormalizado === nombreNormalizado) {
          return {
            duplicado: true,
            tipo: 'nombre',
            mensaje: `Ya existe un estudiante con el nombre: "${estudiante.nombre}" (código: ${estudiante.codigo})`
          };
        }
      }

      return { duplicado: false };
    } catch (error) {
      console.error("Error al verificar duplicados:", error);
      return { duplicado: false }; // En caso de error, permitir la actualización
    }
  };

  // Funciones para editar estudiante
  const abrirModalEditar = (estudiante) => {
    setEditandoEstudiante(estudiante);
    setCodigo(estudiante.codigo);
    setNombre(estudiante.nombre);
    setFacultad(estudiante.facultad);
    setEscuela(estudiante.escuela);
    setCurso(estudiante.curso);
    setTipo(estudiante.tipo);
    setMostrarModalEditar(true);
    setMensaje("");
  };

  const cerrarModalEditar = () => {
    setMostrarModalEditar(false);
    setEditandoEstudiante(null);
    setCodigo("");
    setNombre("");
    setFacultad("");
    setEscuela("");
    setCurso("");
    setTipo("alumno");
    setMensaje("");
  };

  const actualizarEstudiante = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!codigo || !nombre || !facultad || !escuela || !curso || !tipo) {
      setMensaje("⚠️ Completa todos los campos");
      return;
    }

    try {
      setCargando(true);

      // Verificar duplicados antes de actualizar
      const verificacion = await verificarDuplicados(codigo, nombre, editandoEstudiante.id);
      if (verificacion.duplicado) {
        setMensaje(`❌ ${verificacion.mensaje}`);
        setCargando(false);
        return;
      }

      // Normalizar código antes de guardar
      const codigoNormalizado = codigo.trim().toUpperCase();

      // Actualizar el documento del estudiante
      await updateDoc(doc(db, "estudiantes", editandoEstudiante.id), {
        codigo: codigoNormalizado,
        nombre: nombre.trim(),
        facultad: facultad.trim(),
        escuela: escuela.trim(),
        curso: curso.trim(),
        tipo,
        fechaActualizacion: new Date(),
      });

      // Regenerar QR automáticamente si cambió cualquier dato importante
      const datosCambiaron = (
        codigoNormalizado !== editandoEstudiante.codigo ||
        nombre.trim() !== editandoEstudiante.nombre ||
        facultad.trim() !== editandoEstudiante.facultad ||
        escuela.trim() !== editandoEstudiante.escuela ||
        curso.trim() !== editandoEstudiante.curso ||
        tipo !== editandoEstudiante.tipo
      );

      if (datosCambiaron) {
        const dataUrl = await QRCodeGenerator.toDataURL(codigoNormalizado, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 300,
          color: { dark: themes[selectedTheme].primary, light: "#ffffff" },
        });

        await updateDoc(doc(db, "estudiantes", editandoEstudiante.id), {
          qrImage: dataUrl,
          fechaQR: new Date(),
          qrActualizado: true
        });
      }

      setMensaje("✅ Estudiante actualizado exitosamente.");
      cerrarModalEditar();
    } catch (error) {
      console.error("Error al actualizar estudiante:", error);
      setMensaje("❌ No se pudo actualizar el estudiante");
    } finally {
      setCargando(false);
    }
  };

  // Funciones para eliminar estudiante
  const abrirModalEliminar = (estudiante) => {
    setEstudianteAEliminar(estudiante);
    setMostrarModalEliminar(true);
  };

  const cerrarModalEliminar = () => {
    setMostrarModalEliminar(false);
    setEstudianteAEliminar(null);
  };

  const eliminarEstudiante = async () => {
    try {
      setCargando(true);
      await deleteDoc(doc(db, "estudiantes", estudianteAEliminar.id));
      setMensaje("✅ Estudiante eliminado exitosamente.");
      cerrarModalEliminar();
    } catch (error) {
      console.error("Error al eliminar estudiante:", error);
      setMensaje("❌ No se pudo eliminar el estudiante");
    } finally {
      setCargando(false);
    }
  };

  const filteredEstudiantes = estudiantes.filter(
    (e) =>
      e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.curso?.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.escuela?.toLowerCase().includes(busqueda.toLowerCase())
  );
  
  const themeStyles = themes[selectedTheme];

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Contenedor Principal con estilo de tema */}
      <div className={`p-3 sm:p-4 md:p-6 rounded-xl border shadow-lg transition-colors duration-300 ${
        selectedTheme === 'dark'
          ? 'bg-gray-800 text-white border-gray-700'
          : 'bg-white text-gray-900 border-gray-200'
      }`}>
        {/* Encabezado y Barra de Búsqueda */}
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2" style={{ color: themeStyles.primary }}>
            <GraduationCap size={20} style={{ color: themeStyles.primary }} />
            <span className="hidden sm:inline">Listado de Estudiantes</span>
            <span className="sm:hidden">Estudiantes</span>
            <span className="text-sm sm:text-base" style={{ color: themeStyles.textSecondary }}>
              ({estudiantes.length})
            </span>
          </h2>
        </div>

        <input
          type="text"
          placeholder="Buscar por nombre, código, curso o escuela..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={`
            w-full rounded-md p-2.5 sm:p-3 mb-4 sm:mb-6
            focus:ring-2 focus:ring-sky-500 focus:border-sky-500
            text-sm sm:text-base
            transition-colors duration-300
            ${selectedTheme === 'dark' 
              ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }
          `}
        />

        {/* Mensaje de notificación */}
        {mensaje && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md transition-colors duration-300">
            <p className="text-sm text-center text-blue-800">{mensaje}</p>
          </div>
        )}

        {/* Mensaje de lista vacía */}
        {filteredEstudiantes.length === 0 ? (
          <div className="text-center py-8">
            <GraduationCap size={48} className={`mx-auto mb-3 ${
              selectedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <p className={`${
              selectedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {busqueda ? "No se encontraron estudiantes con esa búsqueda." : "No hay estudiantes registrados."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Encabezados de columnas (Solo visible en desktop) */}
            <div className={`hidden lg:block rounded-lg p-4 transition-colors duration-300 ${
              selectedTheme === 'dark'
                ? 'bg-gray-700 border border-gray-600'
                : 'bg-gray-50 border border-gray-200'
            }`} style={{ backgroundColor: themeStyles.background, borderColor: themeStyles.textSecondary }}>
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-1 flex justify-center">
                  <div className="w-5"></div>
                </div>
                <div className="col-span-2">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>NOMBRE</p>
                </div>
                <div className="col-span-1">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>CÓDIGO</p>
                </div>
                <div className="col-span-2">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>FACULTAD</p>
                </div>
                <div className="col-span-2">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>ESCUELA</p>
                </div>
                <div className="col-span-1">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>CURSO</p>
                </div>
                <div className="col-span-1 text-center">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>TIPO</p>
                </div>
                <div className="col-span-1 text-center">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>QR</p>
                </div>
                <div className="col-span-1 text-center">
                  <p className="font-semibold text-sm" style={{ color: themeStyles.primary }}>ACCIONES</p>
                </div>
              </div>
            </div>

            {/* Lista de estudiantes - Responsive */}
            <ul className="space-y-3 sm:space-y-2">
              {filteredEstudiantes.map((e) => {
                const tieneQR = e.qrImage || e.qrDataUrl;
                const estaExpandido = qrExpandido[e.id];
                const estaCargando = cargandoQR[e.id];

                return (
                  <li
                    key={e.id}
                    className="p-3 sm:p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                    style={{
                      background: selectedTheme === 'dark' ? '#1F2937' : 'white',
                      borderColor: selectedTheme === 'dark' ? '#374151' : '#f3f4f6',
                      color: selectedTheme === 'dark' ? 'white' : 'inherit'
                    }}
                  >
                    {/* Contenido de la lista - Vistas Desktop y Móvil */}
                    <div className="lg:grid grid-cols-12 gap-4 items-center hidden">
                      {/* Icono */}
                      <div className="col-span-1 flex justify-center">
                        {e.tipo === "alumno" ? (
                          <GraduationCap size={20} style={{ color: themeStyles.primary }} />
                        ) : (
                          <Users size={20} className="text-gray-600" />
                        )}
                      </div>

                      {/* Nombre y otros datos */}
<<<<<<< HEAD
                      <div className="col-span-3">
                        <p className={`font-semibold truncate ${
                          selectedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                        }`}>{e.nombre}</p>
                      </div>
                      <div className="col-span-2">
                        <p className={`text-sm truncate ${
                          selectedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        }`}>{e.codigo}</p>
                      </div>
                      <div className="col-span-2">
                        <p className={`text-sm truncate ${
                          selectedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        }`}>{e.curso}</p>
=======
                      <div className="col-span-2">
                        <p className="font-semibold text-gray-900 truncate">{e.nombre}</p>
                      </div>
                      <div className="col-span-1">
                        <p className="text-sm text-gray-600 truncate">{e.codigo}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 truncate">{e.facultad}</p>
>>>>>>> b14d28c07ce28e9ab57cb33652fe94e76b58072d
                      </div>
                      <div className="col-span-2">
                        <p className={`text-sm truncate ${
                          selectedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        }`}>{e.escuela}</p>
                      </div>
                      <div className="col-span-1">
                        <p className="text-sm text-gray-600 truncate">{e.curso}</p>
                      </div>

                      {/* Tipo de estudiante */}
                      <div className="col-span-1 flex justify-center">
                        {e.tipo === "externo" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                            <Users size={10} /> Ext
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-white rounded-full" style={{ backgroundColor: themeStyles.primary }}>
                            <GraduationCap size={10} /> USS
                          </span>
                        )}
                      </div>

                      {/* Sección de QR (Desktop) */}
                      <div className="col-span-1 flex justify-center">
                        {tieneQR ? (
                          <div className="text-center space-y-2">
                            <div className="relative">
                              <img
                                src={tieneQR}
                                alt={`QR de ${e.nombre}`}
                                className={`
                                  rounded-md border border-gray-200 shadow-sm
                                  transition-all duration-300 mx-auto
                                  ${estaExpandido ? "w-24 h-24" : "w-12 h-12"}
                                `}
                              />
                              {estaCargando && (
                                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-md">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: themeStyles.primary }}></div>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => toggleQR(e.id)}
                                className="p-1 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                                title={estaExpandido ? "Contraer QR" : "Expandir QR"}
                                disabled={estaCargando}
                              >
                                {estaExpandido ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                onClick={() => descargarQR(e)}
                                className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Descargar QR"
                                disabled={estaCargando}
                              >
                                <Download size={14} />
                              </button>
                              <button
                                onClick={() => regenerarQR(e)}
                                className="p-1 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                title="Regenerar QR"
                                disabled={estaCargando}
                              >
                                <RefreshCw size={14} className={estaCargando ? "animate-spin" : ""} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center space-y-2">
                            <div className="w-12 h-12 bg-gray-100 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center mx-auto transition-colors duration-300">
                              {estaCargando ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: themeStyles.primary }}></div>
                              ) : (
                                <QrCode size={16} className="text-gray-400" />
                              )}
                            </div>

                            <button
                              onClick={() => generarQR(e)}
                              className="px-2 py-1 text-white text-xs rounded-md transition-colors disabled:opacity-50"
                              style={{ backgroundColor: themeStyles.primary }}
                              disabled={estaCargando}
                            >
                              {estaCargando ? "Generando..." : "Generar QR"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Columna de Acciones */}
                      <div className="col-span-1 flex justify-center">
                        <div className="flex gap-1">
                          <button
                            onClick={() => abrirModalEditar(e)}
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar estudiante"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => abrirModalEliminar(e)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar estudiante"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Contenido de la lista - Vistas Móvil/Tablet */}
                    <div className="lg:hidden">
                      {/* Header de la card */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {e.tipo === "alumno" ? (
                            <GraduationCap size={20} style={{ color: themeStyles.primary }} className="flex-shrink-0" />
                          ) : (
                            <Users size={20} className="text-gray-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className={`font-semibold text-sm sm:text-base truncate ${
                              selectedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                            }`}>
                              {e.nombre}
                            </h3>
                            <p className={`text-xs sm:text-sm font-mono ${
                              selectedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              {e.codigo}
                            </p>
                          </div>
                        </div>

                        {/* Badge de tipo */}
                        <div className="flex-shrink-0">
                          {e.tipo === "externo" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                              <Users size={10} /> Ext
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-white rounded-full" style={{ backgroundColor: themeStyles.primary }}>
                              <GraduationCap size={10} /> USS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Información del estudiante */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs sm:text-sm">
                        <div>
                          <span className="text-gray-500">Facultad:</span>
                          <p className="font-medium text-gray-700 truncate">{e.facultad}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Escuela:</span>
                          <p className="font-medium text-gray-700 truncate">{e.escuela}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-gray-500">Curso:</span>
                          <p className="font-medium text-gray-700 truncate">{e.curso}</p>
                        </div>
                      </div>

                      {/* Sección QR */}
                      <div className="border-t border-gray-100 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">Código QR</span>

                          {tieneQR ? (
                            <div className="flex items-center gap-2">
                              {/* Botones de control compactos */}
                              <button
                                onClick={() => toggleQR(e.id)}
                                className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                                title={estaExpandido ? "Contraer QR" : "Expandir QR"}
                                disabled={estaCargando}
                              >
                                {estaExpandido ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button
                                onClick={() => descargarQR(e)}
                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Descargar QR"
                                disabled={estaCargando}
                              >
                                <Download size={12} />
                              </button>
                              <button
                                onClick={() => regenerarQR(e)}
                                className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                title="Regenerar QR"
                                disabled={estaCargando}
                              >
                                <RefreshCw size={12} className={estaCargando ? "animate-spin" : ""} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => generarQR(e)}
                                className="px-2 py-1 text-white text-xs rounded-md transition-colors disabled:opacity-50"
                                style={{ backgroundColor: themeStyles.primary }}
                                disabled={estaCargando}
                              >
                                {estaCargando ? "Generando..." : "Generar"}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* QR expandido en móvil */}
                        {estaExpandido && tieneQR && (
                          <div className="mt-3 text-center">
                            <img
                              src={tieneQR}
                              alt={`QR de ${e.nombre}`}
                              className="w-24 h-24 mx-auto rounded-md border border-gray-200 shadow-sm"
                            />
                            <button
                              onClick={() => descargarQR(e)}
                              className="mt-2 w-full flex items-center justify-center gap-1 text-white px-3 py-2 rounded-md transition-colors text-xs"
                              style={{ backgroundColor: themeStyles.primary }}
                              disabled={estaCargando}
                            >
                              <QrCode size={12} />
                              <Download size={12} />
                              Descargar QR
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Sección de Acciones */}
                      <div className="border-t border-gray-100 pt-3 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">Acciones</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => abrirModalEditar(e)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Editar estudiante"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => abrirModalEliminar(e)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar estudiante"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Modal de Editar Estudiante */}
      {mostrarModalEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ borderColor: themeStyles.textSecondary }}>
            <form onSubmit={actualizarEstudiante} className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: themeStyles.primary }}>
                  <Edit size={22} style={{ color: themeStyles.secondary }} />
                  Editar Estudiante
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
                    style={{ borderColor: themeStyles.textSecondary, focusRingColor: themeStyles.secondary }}
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
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2"
                    style={{ borderColor: themeStyles.textSecondary, focusRingColor: themeStyles.secondary }}
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
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2"
                    style={{ borderColor: themeStyles.textSecondary, focusRingColor: themeStyles.secondary }}
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
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2"
                    style={{ borderColor: themeStyles.textSecondary, focusRingColor: themeStyles.secondary }}
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
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-2"
                    style={{ borderColor: themeStyles.textSecondary, focusRingColor: themeStyles.secondary }}
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
                        style={{ accentColor: themeStyles.secondary }}
                      />
                      <GraduationCap size={18} style={{ color: themeStyles.primary }} />
                      <span className="text-sm text-gray-700">Alumno USS</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-gray-50">
                      <input
                        type="radio"
                        value="externo"
                        checked={tipo === "externo"}
                        onChange={(e) => setTipo(e.target.value)}
                        className="accent-sky-600"
                        style={{ accentColor: themeStyles.secondary }}
                      />
                      <Users size={18} className="text-gray-600" />
                      <span className="text-sm text-gray-700">Externo</span>
                    </label>
                  </div>
                </div>
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
                  {cargando ? "Actualizando..." : "Actualizar Estudiante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar */}
      {mostrarModalEliminar && estudianteAEliminar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md" style={{ borderColor: themeStyles.textSecondary }}>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: themeStyles.primary }}>
                  <Trash2 size={22} style={{ color: '#DC2626' }} />
                  Eliminar Estudiante
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
                  ¿Estás seguro de que deseas eliminar a este estudiante?
                </p>
                <div className="bg-gray-50 p-4 rounded-md" style={{ backgroundColor: `${themeStyles.textSecondary}10` }}>
                  <div className="flex items-center gap-2 mb-2">
                    {estudianteAEliminar.tipo === "externo" ? (
                      <Users size={20} style={{ color: themeStyles.textSecondary }} />
                    ) : (
                      <GraduationCap size={20} style={{ color: themeStyles.primary }} />
                    )}
                    <p className="font-semibold" style={{ color: themeStyles.textPrimary }}>{estudianteAEliminar.nombre}</p>
                  </div>
                  <p className="text-sm font-mono" style={{ color: themeStyles.textSecondary }}>Código: {estudianteAEliminar.codigo}</p>
                  <p className="text-sm" style={{ color: themeStyles.textSecondary }}>Curso: {estudianteAEliminar.curso}</p>
                </div>
                <p className="text-xs mt-2 text-red-600">
                  ⚠️ Esta acción no se puede deshacer y eliminará también el código QR
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
                  onClick={eliminarEstudiante}
                  disabled={cargando}
                  className={`px-4 py-2 rounded-md font-semibold text-white transition-all duration-200`}
                  style={{ backgroundColor: cargando ? '#DC2626' : '#DC2626' }}
                >
                  {cargando ? "Eliminando..." : "Eliminar Estudiante"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}