import { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Search,
  List,
  GraduationCap,
  Users,
  Camera,
  CheckSquare,
  Square,
  LogIn,
  LogOut,
  UserCheck,
  Clock,
  CheckCircle,
  Eye,
  X
} from "lucide-react";
import BarcodeScanner from "react-qr-barcode-scanner";

export default function MarcarAsistencia({ esDocente }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [sesionSeleccionada, setSesionSeleccionada] = useState("1");
  const [vista, setVista] = useState("lista");
  const [cargando, setCargando] = useState(false);
  const [modal, setModal] = useState({ show: false, mensaje: "", nombre: "", accion: "" });
  const [ultimoScanPorCodigo, setUltimoScanPorCodigo] = useState({});
  const [ultimoError, setUltimoError] = useState(0);

  // Estados para funciones de docente
  const [estudiantesSeleccionados, setEstudiantesSeleccionados] = useState([]);
  const [cargandoMasivo, setCargandoMasivo] = useState(false);

  // Estado para el modal de historial
  const [modalHistorial, setModalHistorial] = useState({ show: false, estudiante: null });

  // New state to trigger re-renders for real-time updates
  const [currentTime, setCurrentTime] = useState(Date.now());

  const TIEMPO_LIMITE_MISMO_USUARIO = 30000; // 30 segundos para el mismo código
  const ERROR_DEBOUNCE = 5000;

  // Update currentTime every second to trigger re-renders (only when in "asistencia" view for optimization)
  useEffect(() => {
    if (vista === "asistencia") {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000); // Update every 1 second

      return () => clearInterval(interval); // Cleanup interval on component unmount or view change
    }
  }, [vista]);

  useEffect(() => {
    const unsubEstudiantes = onSnapshot(collection(db, "estudiantes"), (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEstudiantes(lista);
    });

    const unsubAsistencias = onSnapshot(collection(db, "asistencias"), (snapshot) => {
      const registros = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAsistencias(registros);
    });

    return () => {
      unsubEstudiantes();
      unsubAsistencias();
    };
  }, []);

  const mostrarMensaje = (texto, nombre = "", accion = "") => {
    setModal({ show: true, mensaje: texto, nombre, accion });
    setTimeout(() => setModal({ show: false, mensaje: "", nombre: "", accion: "" }), 4000);
  };

  // Función para obtener la última acción de un estudiante en la sesión actual
  const obtenerUltimaAccionEnSesion = (codigo, sesion) => {
    const registrosEnSesion = asistencias
      .filter((a) => a.codigo === codigo && a.sesion === sesion)
      .sort((a, b) => {
        const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
        const tb = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
        return tb - ta; // ORDEN DESCENDENTE - más reciente primero
      });
    
    return registrosEnSesion[0]?.accion || null;
  };

  // Función para verificar si un estudiante está presente (dentro del aula)
  const estaPresente = (codigo) => {
    const ultimaAccion = obtenerUltimaAccionEnSesion(codigo, sesionSeleccionada);
    return ultimaAccion === "entrada";
  };

  // Función para obtener estudiantes actualmente presentes
  const obtenerEstudiantesPresentes = () => {
    return estudiantesFiltrados.filter((e) => estaPresente(e.codigo));
  };

  // Función general para formatear duración en milisegundos
  const formatDuration = (millis) => {
    if (millis <= 0) return "0s";
    
    const segundos = Math.floor((millis / 1000) % 60);
    const minutos = Math.floor((millis / (1000 * 60)) % 60);
    const horas = Math.floor(millis / (1000 * 60 * 60));
    
    if (horas > 0) {
      return `${horas}h ${minutos}m ${segundos}s`;
    } else if (minutos > 0) {
      return `${minutos}m ${segundos}s`;
    } else {
      return `${segundos}s`;
    }
  };

  // Función para obtener todas las sesiones de asistencia de un estudiante
  const getAllAsistenciaSessions = (estudiante) => {
    const acciones = asistenciasFiltradas
      .filter((a) => a.codigo === estudiante.codigo)
      .map((a) => ({
        ...a,
        date: a.timestamp?.toDate?.() || new Date(a.timestamp || 0)
      }))
      .sort((a, b) => a.date - b.date); // Orden ascendente por fecha para procesamiento

    const sessions = [];
    let i = 0;
    while (i < acciones.length) {
      if (acciones[i].accion === "entrada") {
        const entry = acciones[i];
        let exit = null;
        // Buscar la salida más cercana después de esta entrada
        for (let j = i + 1; j < acciones.length; j++) {
          if (acciones[j].accion === "salida" && acciones[j].date > entry.date) {
            exit = acciones[j];
            i = j + 1;
            break;
          }
        }
        if (!exit) {
          i++; // Si no hay salida, avanzar
        }
        const durationMillis = exit 
          ? exit.date.getTime() - entry.date.getTime()
          : currentTime - entry.date.getTime();
        const duration = formatDuration(durationMillis);
        sessions.push({ entry, exit, duration, isOpen: !exit });
      } else {
        // Salida huérfana, ignorar
        i++;
      }
    }

    // ORDENAR SESIONES POR FECHA DESCENDENTE (más reciente primero)
    sessions.sort((a, b) => b.entry.date.getTime() - a.entry.date.getTime());

    // Calcular total en milisegundos
    const totalMillis = sessions.reduce((sum, s) => {
      const entryTime = s.entry.date.getTime();
      const endTime = s.exit ? s.exit.date.getTime() : currentTime;
      return sum + (endTime - entryTime);
    }, 0);

    const totalTime = formatDuration(totalMillis);

    return { sessions, totalTime };
  };

  const marcarEntrada = async (persona) => {
    try {
      setCargando(true);
      
      await addDoc(collection(db, "asistencias"), {
        nombre: persona.nombre,
        codigo: persona.codigo,
        tipo: persona.tipo,
        curso: persona.curso,
        escuela: persona.escuela,
        accion: "entrada",
        sesion: sesionSeleccionada,
        timestamp: serverTimestamp()
      });
      
      mostrarMensaje(`Entrada registrada en sesión ${sesionSeleccionada}`, persona.nombre, "entrada");
    } catch (err) {
      console.error(err);
      mostrarMensaje("❌ Error al registrar entrada");
    } finally {
      setCargando(false);
    }
  };

  const marcarSalida = async (persona) => {
    try {
      setCargando(true);
      
      await addDoc(collection(db, "asistencias"), {
        nombre: persona.nombre,
        codigo: persona.codigo,
        tipo: persona.tipo,
        curso: persona.curso,
        escuela: persona.escuela,
        accion: "salida",
        sesion: sesionSeleccionada,
        timestamp: serverTimestamp()
      });
      
      mostrarMensaje(`Salida registrada en sesión ${sesionSeleccionada}`, persona.nombre, "salida");
    } catch (err) {
      console.error(err);
      mostrarMensaje("❌ Error al registrar salida");
    } finally {
      setCargando(false);
    }
  };

  // Funciones para docentes - Selección múltiple
  const toggleSeleccion = (estudianteId) => {
    setEstudiantesSeleccionados(prev => 
      prev.includes(estudianteId) 
        ? prev.filter(id => id !== estudianteId)
        : [...prev, estudianteId]
    );
  };

  const seleccionarTodos = () => {
    const estudiantesFiltradosLocal = estudiantes.filter(e => 
      e.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
    if (estudiantesSeleccionados.length === estudiantesFiltradosLocal.length) {
      setEstudiantesSeleccionados([]);
    } else {
      setEstudiantesSeleccionados(estudiantesFiltradosLocal.map(e => e.id));
    }
  };

  const marcarEntradaMasiva = async () => {
    try {
      setCargandoMasivo(true);
      const estudiantesAMarcar = estudiantes.filter(e => 
        estudiantesSeleccionados.includes(e.id)
      );
      
      const promesas = estudiantesAMarcar.map(estudiante =>
        addDoc(collection(db, "asistencias"), {
          nombre: estudiante.nombre,
          codigo: estudiante.codigo,
          tipo: estudiante.tipo,
          curso: estudiante.curso,
          escuela: estudiante.escuela,
          accion: "entrada",
          sesion: sesionSeleccionada,
          timestamp: serverTimestamp()
        })
      );

      await Promise.all(promesas);
      
      mostrarMensaje(`✅ Entrada registrada para ${estudiantesAMarcar.length} estudiantes en sesión ${sesionSeleccionada}`);
      setEstudiantesSeleccionados([]);
    } catch (err) {
      console.error(err);
      mostrarMensaje("❌ Error al registrar entradas masivas");
    } finally {
      setCargandoMasivo(false);
    }
  };

  const marcarSalidaMasiva = async () => {
    try {
      setCargandoMasivo(true);
      const estudiantesAMarcar = estudiantes.filter(e => 
        estudiantesSeleccionados.includes(e.id)
      );

      const promesas = estudiantesAMarcar.map(estudiante =>
        addDoc(collection(db, "asistencias"), {
          nombre: estudiante.nombre,
          codigo: estudiante.codigo,
          tipo: estudiante.tipo,
          curso: estudiante.curso,
          escuela: estudiante.escuela,
          accion: "salida",
          sesion: sesionSeleccionada,
          timestamp: serverTimestamp()
        })
      );

      await Promise.all(promesas);
      
      mostrarMensaje(`✅ Salida registrada para ${estudiantesAMarcar.length} estudiantes en sesión ${sesionSeleccionada}`);
      setEstudiantesSeleccionados([]);
    } catch (err) {
      console.error(err);
      mostrarMensaje("❌ Error al registrar salidas masivas");
    } finally {
      setCargandoMasivo(false);
    }
  };

  // Función para determinar qué botón mostrar basado en la última acción
  const obtenerProximaAccion = (codigo) => {
    const ultimaAccion = obtenerUltimaAccionEnSesion(codigo, sesionSeleccionada);
    return ultimaAccion === "entrada" ? "salida" : "entrada";
  };

  // Función para calcular el tiempo de permanencia (actualizada para usar formatDuration)
  const calcularTiempoPermanencia = (entrada, salida) => {
    if (!entrada || !salida) return "-";
    
    const fechaEntrada = entrada.timestamp?.toDate?.() || new Date(entrada.timestamp || 0);
    const fechaSalida = salida.timestamp?.toDate?.() || new Date(salida.timestamp || 0);
    
    const diferencia = fechaSalida.getTime() - fechaEntrada.getTime();
    
    return formatDuration(diferencia);
  };

  // Función para calcular tiempo transcurrido desde la entrada (para estudiantes presentes) (actualizada)
  const calcularTiempoEnAula = (entrada) => {
    if (!entrada) return "-";
    
    const fechaEntrada = entrada.timestamp?.toDate?.() || new Date(entrada.timestamp || 0);
    const ahora = new Date(currentTime); // Use currentTime state for real-time updates
    
    const diferencia = ahora.getTime() - fechaEntrada.getTime();
    
    return formatDuration(diferencia);
  };

  const formatDate = (v) => {
    if (!v) return "";
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return d.toLocaleString();
  };

  // Función para abrir el modal de historial
  const abrirHistorial = (estudiante) => {
    setModalHistorial({ show: true, estudiante });
  };

  // Función para cerrar el modal de historial
  const cerrarHistorial = () => {
    setModalHistorial({ show: false, estudiante: null });
  };

  const handleScan = async (err, result) => {
    if (!!result) {
      console.log("🔍 QR detectado:", result.text);
      const ahora = Date.now();
      
      let codigoEscaneado = result.text;
      if (result.text.includes('{')) {
        try {
          const data = JSON.parse(result.text);
          codigoEscaneado = data.codigo;
          console.log("📦 JSON parseado, código extraído:", codigoEscaneado);
        } catch (parseErr) {
          console.error("❌ Error parseando JSON:", parseErr);
          mostrarMensaje("QR inválido");
          return;
        }
      }

      // Verificar límite de tiempo para el mismo código
      const ultimoScanEsteCodigo = ultimoScanPorCodigo[codigoEscaneado] || 0;
      if (ahora - ultimoScanEsteCodigo < TIEMPO_LIMITE_MISMO_USUARIO) {
        console.log(`⏱️ Escaneo del mismo código (${codigoEscaneado}) dentro de los 30 segundos, ignorando...`);
        return; // No mostrar mensaje, simplemente ignorar
      }

      // Actualizar el tiempo del último scan para este código específico
      setUltimoScanPorCodigo(prev => ({
        ...prev,
        [codigoEscaneado]: ahora
      }));

      const estudiante = estudiantes.find((e) => e.codigo === codigoEscaneado);
      console.log("👤 Estudiante encontrado:", estudiante);
      
      if (estudiante) {
        const proximaAccion = obtenerProximaAccion(estudiante.codigo);
        if (proximaAccion === "entrada") {
          await marcarEntrada(estudiante);
        } else {
          await marcarSalida(estudiante);
        }
      } else {
        mostrarMensaje(`Estudiante no encontrado para código: ${codigoEscaneado}`);
      }
    }
    
    if (!!err) {
      if (err.name === 'NotFoundException' || 
          (err.message && err.message.includes('No MultiFormat Readers'))) {
        return;
      }
      const ahora = Date.now();
      if (ahora - ultimoError > ERROR_DEBOUNCE) {
        console.error("Error crítico en escáner:", err.message || err);
        setUltimoError(ahora);
        mostrarMensaje("Error en cámara. Verifica permisos o iluminación.");
      }
    }
  };

  // Memoized filtered students for lista view
  const estudiantesFiltrados = useMemo(() => 
    estudiantes.filter((e) => 
      e.nombre.toLowerCase().includes(busqueda.toLowerCase())
    ),
    [estudiantes, busqueda]
  );

  // Filtrar asistencias por sesión seleccionada
  const asistenciasFiltradas = useMemo(() => 
    asistencias.filter(a => a.sesion === sesionSeleccionada),
    [asistencias, sesionSeleccionada]
  );

  // Verificar si hay asistencias para la sesión seleccionada
  const hayAsistenciasEnSesion = asistenciasFiltradas.length > 0;

  // Para vista asistencia - estudiantes con registros en la sesión
  const estudiantesConAsistencia = useMemo(() => {
    const codigosUnicos = new Set(asistenciasFiltradas.map(a => a.codigo));
    return estudiantes.filter(e => codigosUnicos.has(e.codigo)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [estudiantes, asistenciasFiltradas]);

  // Filtrados por búsqueda para asistencia (solo para docente)
  const estudiantesAsistenciaFiltrados = useMemo(() => 
    estudiantesConAsistencia.filter((e) => 
      e.nombre.toLowerCase().includes(busqueda.toLowerCase())
    ),
    [estudiantesConAsistencia, busqueda]
  );

  // Presentes filtrados para indicador
  const presentesFiltrados = useMemo(() => 
    estudiantesAsistenciaFiltrados.filter(e => estaPresente(e.codigo)),
    [estudiantesAsistenciaFiltrados]
  );

  return (
    <div className={`bg-blue-50 p-4 sm:p-6 rounded-xl shadow-md border border-blue-200 mb-6 w-full ${!esDocente ? 'mx-auto max-w-5xl' : 'ml-0'}`}>
      {/* Header con información del modo */}
      <div className="mb-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
        <div className="flex items-center gap-2">
          <UserCheck size={20} className={esDocente ? "text-green-600" : "text-sky-600"} />
          <span className="font-medium text-gray-700">
            {esDocente ? "Modo Docente - Control de Asistencia" : "Registro de Asistencia"}
          </span>
        </div>
        {esDocente && (
          <p className="text-xs text-gray-600 mt-1">
            Puedes seleccionar múltiples estudiantes y marcar asistencia masiva
          </p>
        )}
      </div>

      {/* Combobox para seleccionar sesión */}
      <div className="mb-6">
        <label htmlFor="sesion" className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar Sesión
        </label>
        <select
          id="sesion"
          value={sesionSeleccionada}
          onChange={(e) => setSesionSeleccionada(e.target.value)}
          className="w-full border border-blue-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num.toString()}>
              Sesión {num}
            </option>
          ))}
        </select>
      </div>

      {/* Botones en la parte superior derecha */}
      <div className="mb-6 flex flex-col sm:flex-row justify-end gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setVista("lista")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-sm border ${
              vista === "lista"
                ? "bg-blue-200 border-blue-400 text-sky-800"
                : "bg-blue-50 border-blue-300 text-gray-700 hover:bg-blue-100"
            }`}
          >
            <List size={18} />
            Lista
          </button>
          <button
            onClick={() => setVista("asistencia")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-sm border ${
              vista === "asistencia"
                ? "bg-blue-200 border-blue-400 text-sky-800"
                : "bg-blue-50 border-blue-300 text-gray-700 hover:bg-blue-100"
            }`}
          >
            <Search size={18} />
            {esDocente ? "Control Asistencia" : "Presentes en Aula"}
          </button>
          <button
            onClick={() => setVista("escaner")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-sm border ${
              vista === "escaner"
                ? "bg-blue-200 border-blue-400 text-sky-800"
                : "bg-blue-50 border-blue-300 text-gray-700 hover:bg-blue-100"
            }`}
          >
            <Camera size={18} />
            Escáner QR
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full border border-blue-300 rounded-md p-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
      />

      {/* Controles para docentes */}
      {esDocente && vista === "lista" && (
        <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={seleccionarTodos}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              {estudiantesSeleccionados.length === estudiantesFiltrados.length ? (
                <CheckSquare size={16} />
              ) : (
                <Square size={16} />
              )}
              {estudiantesSeleccionados.length === estudiantesFiltrados.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
            
            {estudiantesSeleccionados.length > 0 && (
              <>
                <span className="text-sm text-gray-600">
                  {estudiantesSeleccionados.length} seleccionados
                </span>
                <button
                  onClick={marcarEntradaMasiva}
                  disabled={cargandoMasivo}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  <LogIn size={16} />
                  Marcar Entrada
                </button>
                <button
                  onClick={marcarSalidaMasiva}
                  disabled={cargandoMasivo}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <LogOut size={16} />
                  Marcar Salida
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {vista === "lista" && (
        <ul className="space-y-2">
          {estudiantesFiltrados.map((e) => {
              const proximaAccion = obtenerProximaAccion(e.codigo);

              return (
                <li
                  key={e.id}
                  className="flex flex-col sm:flex-row items-center justify-between bg-blue-50 p-3 rounded-md border border-blue-200 shadow-sm"
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {esDocente && (
                      <button
                        onClick={() => toggleSeleccion(e.id)}
                        className="text-sky-600 hover:text-sky-800"
                      >
                        {estudiantesSeleccionados.includes(e.id) ? (
                          <CheckSquare size={20} />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                    )}
                    
                    {e.tipo === "externo" ? (
                      <Users size={20} className="text-gray-600" />
                    ) : (
                      <GraduationCap size={20} className="text-sky-700" />
                    )}
                    <div>
                      <p className="font-semibold text-sky-800">{e.nombre}</p>
                      <p className="text-xs text-gray-600">
                        {e.codigo} • {e.tipo === "externo" ? "Externo" : "Alumno USS"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-0">
                    {proximaAccion === "entrada" ? (
                      <button
                        onClick={() => marcarEntrada(e)}
                        disabled={cargando}
                        className="bg-sky-700 text-white px-3 py-1 rounded-md text-sm hover:bg-sky-800 disabled:opacity-50 flex items-center gap-1"
                      >
                        <LogIn size={14} />
                        Entrada
                      </button>
                    ) : (
                      <button
                        onClick={() => marcarSalida(e)}
                        disabled={cargando}
                        className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <LogOut size={14} />
                        Salida
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      {vista === "asistencia" && (
        <>
          {/* Indicador */}
          <div className={`mb-4 p-3 rounded-lg border ${esDocente ? 'bg-blue-100 border-blue-300' : 'bg-green-100 border-green-300'}`}>
            <div className="flex items-center gap-2">
              <Users size={18} className={esDocente ? "text-blue-600" : "text-green-600"} />
              <span className={`font-medium ${esDocente ? 'text-blue-800' : 'text-green-800'}`}>
                {esDocente 
                  ? `Control Sesión ${sesionSeleccionada}: ${estudiantesAsistenciaFiltrados.length} estudiantes (${presentesFiltrados.length} presentes)`
                  : `Estudiantes presentes en aula: ${obtenerEstudiantesPresentes().length}`
                }
              </span>
            </div>
          </div>

          {esDocente ? (
            // Vista para docente: Lista con último registro y botón "Ver más"
            <div className="space-y-4">
              {estudiantesAsistenciaFiltrados.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {hayAsistenciasEnSesion 
                    ? "No hay estudiantes con registros en esta sesión."
                    : `No hay registros de asistencia para la sesión ${sesionSeleccionada}.`
                  }
                </div>
              ) : (
                estudiantesAsistenciaFiltrados.map((estudiante) => {
                  const { sessions, totalTime } = getAllAsistenciaSessions(estudiante);
                  const isPresent = sessions.length > 0 && sessions[sessions.length - 1].isOpen;
                  const headerBgClass = isPresent ? 'bg-green-100' : 'bg-red-100';
                  const dotClass = isPresent ? 'bg-green-500 animate-pulse' : 'bg-red-500';
                  
                  // Mostrar solo la sesión más reciente (primera en el array porque está ordenado descendente)
                  const ultimaSesion = sessions[0];

                  return (
                    <div key={estudiante.id} className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
                      {/* Header del estudiante */}
                      <div className={`${headerBgClass} px-4 py-3 border-b border-blue-200`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>
                            <h3 className="text-sm font-semibold text-gray-800">{estudiante.nombre}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              isPresent ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                            }`}>
                              {isPresent ? <CheckCircle size={10} className="inline mr-1" /> : null}
                              {isPresent ? "Presente" : "Completado"}
                            </span>
                            {sessions.length > 1 && (
                              <button
                                onClick={() => abrirHistorial(estudiante)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                              >
                                <Eye size={12} />
                                Ver más
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Último registro */}
                      {ultimaSesion ? (
                        <div className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-600">
                            <span><strong>Entrada:</strong> {formatDate(ultimaSesion.entry.timestamp)}</span>
                            {ultimaSesion.exit ? (
                              <>
                                <span><strong>Salida:</strong> {formatDate(ultimaSesion.exit.timestamp)}</span>
                                <span className="font-medium text-blue-600">{ultimaSesion.duration}</span>
                              </>
                            ) : (
                              <span className="font-medium text-green-600">
                                <Clock size={12} className="inline mr-1" />
                                En curso: {ultimaSesion.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="px-4 py-3 text-sm text-gray-500 text-center">Sin registros de asistencia</p>
                      )}
                      
                      {/* Total */}
                      <div className="bg-gray-50 px-4 py-2 border-t border-blue-200">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600 font-medium">Tiempo total en aula:</span>
                          <span className="text-blue-600 font-semibold">
                            <Clock size={14} className="inline mr-1" />
                            {totalTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Vista para no docente: Tabla de presentes
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border border-blue-200 rounded-md shadow-sm">
                <thead className="bg-blue-100 text-sky-800 text-left">
                  <tr>
                    <th className="px-4 py-2 border-r border-blue-300">Nombre</th>
                    <th className="px-4 py-2 border-r border-blue-300">Hora de Entrada</th>
                    <th className="px-4 py-2 border-r border-blue-300">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const estudiantesPresentes = obtenerEstudiantesPresentes();
                    
                    if (estudiantesPresentes.length === 0) {
                      return (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                            {hayAsistenciasEnSesion 
                              ? "No hay estudiantes presentes en el aula actualmente."
                              : `No hay registros de asistencia para la sesión ${sesionSeleccionada}.`
                            }
                          </td>
                        </tr>
                      );
                    }

                    return estudiantesPresentes.map((estudiante) => {
                      // Obtener la última entrada (sin salida posterior)
                      const ultimaEntrada = asistenciasFiltradas
                        .filter((a) => a.codigo === estudiante.codigo && a.accion === "entrada")
                        .sort((a, b) => {
                          const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                          const tb = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                          return tb - ta; // Más reciente primero
                        })[0];

                      return (
                        <tr key={estudiante.id} className="border-t border-blue-200 bg-green-50">
                          <td className="px-4 py-2 text-sm font-semibold text-gray-800 border-r border-blue-300">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              {estudiante.nombre}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 border-r border-blue-300">
                            {ultimaEntrada ? formatDate(ultimaEntrada.timestamp) : "-"}
                          </td>
                          <td className="px-4 py-2 text-sm border-r border-blue-300">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-medium">
                              <CheckCircle size={12} />
                              Presente
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {vista === "escaner" && (
        <div className="flex flex-col items-center space-y-4 w-full">
          <h3 className="text-lg font-semibold text-sky-800">Escanea el Código QR para Registrar</h3>
          <p className="text-sm text-gray-600 text-center">
            Enfoca la cámara en el QR del estudiante. Se registrará entrada o salida automáticamente para la sesión {sesionSeleccionada}.
          </p>
          <div className="w-full max-w-md border border-blue-300 rounded-md overflow-hidden shadow-md">
            <BarcodeScanner
              width={500}
              height={400}
              onUpdate={handleScan}
              facingMode="environment"
              formats={['qr_code']}
            />
          </div>
        </div>
      )}

      {/* Modal para mensajes */}
      {modal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-blue-50 p-6 rounded-lg shadow-xl max-w-sm w-full sm:w-80 border border-blue-300">
            <div className="flex flex-col items-center gap-4">
              <CheckCircle 
                size={48} 
                className={`${
                  modal.mensaje.includes("Error") || modal.mensaje.includes("invalido") 
                    ? "text-red-500" 
                    : modal.accion === "salida" 
                      ? "text-red-500 animate-pulse" 
                      : "text-green-500 animate-pulse"
                }`} 
              />
              <p className="text-lg font-semibold text-gray-800 text-center">
                {modal.mensaje.includes("Error") || modal.mensaje.includes("invalido")
                  ? modal.mensaje
                  : `${modal.accion.charAt(0).toUpperCase() + modal.accion.slice(1)} registrada para ${modal.nombre}`}
              </p>
              <p className="text-sm text-gray-600 text-center">
                {modal.mensaje.includes("Error") || modal.mensaje.includes("invalido")
                  ? ""
                  : `Sesión ${sesionSeleccionada}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial Completo */}
      {modalHistorial.show && modalHistorial.estudiante && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            {/* Header del modal */}
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Historial de Asistencia</h2>
                <p className="text-blue-100 text-sm">{modalHistorial.estudiante.nombre} - Sesión {sesionSeleccionada}</p>
              </div>
              <button
                onClick={cerrarHistorial}
                className="text-white hover:text-blue-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {(() => {
                const { sessions, totalTime } = getAllAsistenciaSessions(modalHistorial.estudiante);
                
                if (sessions.length === 0) {
                  return (
                    <p className="text-center py-8 text-gray-500">Sin registros de asistencia</p>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Resumen */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Total de sesiones:</span>
                        <span className="text-blue-600 font-semibold">{sessions.length}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-gray-700 font-medium">Tiempo total acumulado:</span>
                        <span className="text-blue-600 font-semibold">
                          <Clock size={16} className="inline mr-1" />
                          {totalTime}
                        </span>
                      </div>
                    </div>

                    {/* Lista de sesiones */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-gray-800 border-b border-gray-200 pb-2">
                        Registro detallado (más reciente primero):
                      </h3>
                      {sessions.map((session, index) => {
                        const isOpen = session.isOpen;
                        return (
                          <div key={index} className={`border rounded-lg p-4 ${isOpen ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-800">Sesión {index + 1}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isOpen ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'
                              }`}>
                                {isOpen ? 'En curso' : 'Completada'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-600">Entrada:</span>
                                <p className="text-gray-800">{formatDate(session.entry.timestamp)}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Salida:</span>
                                <p className="text-gray-800">
                                  {session.exit ? formatDate(session.exit.timestamp) : 'En curso...'}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">Duración:</span>
                                <p className={`font-medium ${isOpen ? 'text-green-600' : 'text-blue-600'}`}>
                                  <Clock size={14} className="inline mr-1" />
                                  {session.duration}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer del modal */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
              <button
                onClick={cerrarHistorial}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de carga masiva */}
      {cargandoMasivo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-blue-50 p-6 rounded-lg shadow-lg border border-blue-300">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Procesando registros masivos...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}