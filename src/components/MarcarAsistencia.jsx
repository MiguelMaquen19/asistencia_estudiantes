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

export default function MarcarAsistencia({ esDocente, theme, themes, isDarkMode, dynamicThemeStyles }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [sesionSeleccionada, setSesionSeleccionada] = useState("1");
  const [vista, setVista] = useState("lista");
  const [cargando, setCargando] = useState(false);
  const [modal, setModal] = useState({ show: false, mensaje: "", nombre: "", accion: "" });
  const [ultimoScanPorCodigo, setUltimoScanPorCodigo] = useState({});
  const [ultimoError, setUltimoError] = useState(0);
  const [estudiantesSeleccionados, setEstudiantesSeleccionados] = useState([]);
  const [cargandoMasivo, setCargandoMasivo] = useState(false);
  const [modalHistorial, setModalHistorial] = useState({ show: false, estudiante: null });
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [horaActual, setHoraActual] = useState(new Date());

  const TIEMPO_LIMITE_MISMO_USUARIO = 30000;
  const ERROR_DEBOUNCE = 5000;

  // Estilos del tema
  const themeStyles = themes[theme] || themes.blue;
  
  // Estilos dinámicos basados en el modo oscuro/claro
  const getContainerStyles = () => ({
    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary
  });

  useEffect(() => {
    if (vista === "asistencia") {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [vista]);

  // Reloj en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const obtenerUltimaAccionEnSesion = (codigo, sesion) => {
    const registrosEnSesion = asistencias
      .filter((a) => a.codigo === codigo && a.sesion === sesion)
      .sort((a, b) => {
        const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
        const tb = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
        return tb - ta;
      });
    return registrosEnSesion[0]?.accion || null;
  };

  const estaPresente = (codigo) => {
    const estudiante = estudiantes.find(e => e.codigo === codigo);
    if (!estudiante) return false;
    const { sessions } = getAllAsistenciaSessions(estudiante);
    return sessions.length > 0 && sessions[0].isOpen;
  };

  const obtenerEstudiantesPresentes = () => {
    return estudiantesFiltrados.filter((e) => estaPresente(e.codigo));
  };

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

  const getAllAsistenciaSessions = (estudiante) => {
    const acciones = asistenciasFiltradas
      .filter((a) => a.codigo === estudiante.codigo)
      .map((a) => ({
        ...a,
        date: a.timestamp?.toDate?.() || new Date(a.timestamp || 0)
      }))
      .sort((a, b) => a.date - b.date);

    const sessions = [];
    let i = 0;
    while (i < acciones.length) {
      if (acciones[i].accion === "entrada") {
        const entry = acciones[i];
        let exit = null;
        for (let j = i + 1; j < acciones.length; j++) {
          if (acciones[j].accion === "salida" && acciones[j].date > entry.date) {
            exit = acciones[j];
            i = j + 1;
            break;
          }
        }
        if (!exit) {
          i++;
        }
        const durationMillis = exit 
          ? exit.date.getTime() - entry.date.getTime()
          : currentTime - entry.date.getTime();
        const duration = formatDuration(durationMillis);
        sessions.push({ entry, exit, duration, isOpen: !exit });
      } else {
        i++;
      }
    }
    sessions.sort((a, b) => b.entry.date.getTime() - a.entry.date.getTime());
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

  const obtenerProximaAccion = (codigo) => {
    const estudiante = estudiantes.find(e => e.codigo === codigo);
    if (!estudiante) return "entrada";
    const { sessions } = getAllAsistenciaSessions(estudiante);
    // Si no hay sesiones o la última sesión está cerrada, la próxima acción es entrada
    // Si la última sesión está abierta, la próxima acción es salida
    return (sessions.length > 0 && sessions[0].isOpen) ? "salida" : "entrada";
  };

  const calcularTiempoPermanencia = (entrada, salida) => {
    if (!entrada || !salida) return "-";
    const fechaEntrada = entrada.timestamp?.toDate?.() || new Date(entrada.timestamp || 0);
    const fechaSalida = salida.timestamp?.toDate?.() || new Date(salida.timestamp || 0);
    const diferencia = fechaSalida.getTime() - fechaEntrada.getTime();
    return formatDuration(diferencia);
  };

  const calcularTiempoEnAula = (entrada) => {
    if (!entrada) return "-";
    const fechaEntrada = entrada.timestamp?.toDate?.() || new Date(entrada.timestamp || 0);
    const ahora = new Date(currentTime);
    const diferencia = ahora.getTime() - fechaEntrada.getTime();
    return formatDuration(diferencia);
  };

  const formatDate = (v) => {
    if (!v) return "";
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return d.toLocaleString();
  };

  const abrirHistorial = (estudiante) => {
    setModalHistorial({ show: true, estudiante });
  };

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
      const ultimoScanEsteCodigo = ultimoScanPorCodigo[codigoEscaneado] || 0;
      if (ahora - ultimoScanEsteCodigo < TIEMPO_LIMITE_MISMO_USUARIO) {
        console.log(`⏱️ Escaneo del mismo código (${codigoEscaneado}) dentro de los 30 segundos, ignorando...`);
        return;
      }
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

  const estudiantesFiltrados = useMemo(() => 
    estudiantes.filter((e) => 
      e.nombre.toLowerCase().includes(busqueda.toLowerCase())
    ),
    [estudiantes, busqueda]
  );

  const asistenciasFiltradas = useMemo(() => 
    asistencias.filter(a => a.sesion === sesionSeleccionada),
    [asistencias, sesionSeleccionada]
  );

  const hayAsistenciasEnSesion = asistenciasFiltradas.length > 0;

  const estudiantesConAsistencia = useMemo(() => {
    const codigosUnicos = new Set(asistenciasFiltradas.map(a => a.codigo));
    return estudiantes.filter(e => codigosUnicos.has(e.codigo)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [estudiantes, asistenciasFiltradas]);

  const estudiantesAsistenciaFiltrados = useMemo(() => 
    estudiantesConAsistencia.filter((e) => 
      e.nombre.toLowerCase().includes(busqueda.toLowerCase())
    ),
    [estudiantesConAsistencia, busqueda]
  );

  const presentesFiltrados = useMemo(() => 
    estudiantesAsistenciaFiltrados.filter(e => estaPresente(e.codigo)),
    [estudiantesAsistenciaFiltrados]
  );

  return (
    <div className="p-4 sm:p-6 rounded-xl shadow-md border w-full" 
      style={{ 
        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
        borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
        marginLeft: esDocente ? '0' : 'auto', 
        maxWidth: esDocente ? 'none' : '80rem',
        color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary
      }}>
      {/* Header con información del modo */}
      <div className="mb-4 p-3 rounded-lg border" 
        style={{ 
          backgroundColor: isDarkMode ? '#111827' : `${themeStyles.primary}20`,
          borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary 
        }}>
        <div className="flex items-center gap-2">
          <UserCheck size={20} style={{ color: isDarkMode ? '#93C5FD' : (esDocente ? '#047857' : themeStyles.primary) }} />
          <span className="font-medium" style={{ color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary }}>
            {esDocente ? "Modo Docente - Control de Asistencia" : "Registro de Asistencia"}
          </span>
        </div>
        {esDocente && (
          <p className="text-xs mt-1" style={{ color: isDarkMode ? '#D1D5DB' : themeStyles.textSecondary }}>
            Puedes seleccionar múltiples estudiantes y marcar asistencia masiva
          </p>
        )}
      </div>

      {/* Combobox para seleccionar sesión */}
      <div className="mb-6">
        <label htmlFor="sesion" className="block text-sm font-medium mb-2" style={{ color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary }}>
          Seleccionar Sesión
        </label>
        <select
          id="sesion"
          value={sesionSeleccionada}
          onChange={(e) => setSesionSeleccionada(e.target.value)}
          className="w-full border rounded-md p-2 focus:outline-none focus:ring-2"
          style={{ 
            borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
            backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
            color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary 
          }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num.toString()}>
              Sesión {num}
            </option>
          ))}
        </select>
      </div>

      {/* Reloj en tiempo real y botones en la parte superior derecha */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Reloj en tiempo real */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm" 
          style={{ 
            backgroundColor: isDarkMode ? '#111827' : `${themeStyles.primary}20`, 
            borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
            color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary
          }}>
          <Clock size={20} style={{ color: isDarkMode ? '#93C5FD' : themeStyles.primary }} />
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary }}>
              {horaActual.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
              })}
            </div>
            <div className="text-xs" style={{ color: isDarkMode ? '#D1D5DB' : themeStyles.textSecondary }}>
              {horaActual.toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setVista("lista")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-sm border ${
              vista === "lista"
                ? "text-white"
                : "hover:bg-opacity-10"
            }`}
            style={{
              backgroundColor: vista === "lista" 
                ? themeStyles.secondary 
                : (isDarkMode ? '#111827' : '#FFFFFF'),
              borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
              color: isDarkMode 
                ? (vista === "lista" ? '#FFFFFF' : '#D1D5DB')
                : (vista === "lista" ? '#FFFFFF' : themeStyles.textPrimary),
            }}
          >
            <List size={18} />
            Lista
          </button>
          <button
            onClick={() => setVista("asistencia")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-sm border ${
              vista === "asistencia"
                ? "text-white"
                : "hover:bg-opacity-10"
            }`}
            style={{
              backgroundColor: vista === "asistencia" 
                ? themeStyles.secondary 
                : (isDarkMode ? '#111827' : '#FFFFFF'),
              borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
              color: isDarkMode 
                ? (vista === "asistencia" ? '#FFFFFF' : '#D1D5DB')
                : (vista === "asistencia" ? '#FFFFFF' : themeStyles.textPrimary),
            }}
          >
            <Search size={18} />
            {esDocente ? "Control Asistencia" : "Presentes en Aula"}
          </button>
          <button
            onClick={() => setVista("escaner")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-sm border ${
              vista === "escaner"
                ? "text-white"
                : "hover:bg-opacity-10"
            }`}
            style={{
              backgroundColor: vista === "escaner" 
                ? themeStyles.secondary 
                : (isDarkMode ? '#111827' : '#FFFFFF'),
              borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
              color: isDarkMode 
                ? (vista === "escaner" ? '#FFFFFF' : '#D1D5DB')
                : (vista === "escaner" ? '#FFFFFF' : themeStyles.textPrimary),
            }}
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
        className="w-full border rounded-md p-2 mb-6 focus:outline-none focus:ring-2"
        style={{ 
          borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary,
          caretColor: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary,
        }}
      />

      {/* Controles para docentes */}
      {esDocente && vista === "lista" && (
        <div className="mb-4 p-4 rounded-lg border" 
          style={{ 
            backgroundColor: isDarkMode ? '#111827' : `${themeStyles.primary}20`, 
            borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary 
          }}>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={seleccionarTodos}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF' }}
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
                <span className="text-sm" style={{ color: themeStyles.textSecondary }}>
                  {estudiantesSeleccionados.length} seleccionados
                </span>
                <button
                  onClick={marcarEntradaMasiva}
                  disabled={cargandoMasivo}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#047857', color: '#FFFFFF' }}
                >
                  <LogIn size={16} />
                  Marcar Entrada
                </button>
                <button
                  onClick={marcarSalidaMasiva}
                  disabled={cargandoMasivo}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
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
                className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-md border shadow-sm"
                style={getContainerStyles()}
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {esDocente && (
                    <button
                      onClick={() => toggleSeleccion(e.id)}
                      className="hover:text-opacity-80"
                      style={{ color: themeStyles.primary }}
                    >
                      {estudiantesSeleccionados.includes(e.id) ? (
                        <CheckSquare size={20} />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                  )}
                  {e.tipo === "externo" ? (
                    <Users size={20} style={{ color: themeStyles.textSecondary }} />
                  ) : (
                    <GraduationCap size={20} style={{ color: themeStyles.primary }} />
                  )}
                  <div>
                    <p className="font-semibold" style={{ color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary }}>{e.nombre}</p>
                    <p className="text-xs" style={{ color: isDarkMode ? '#D1D5DB' : themeStyles.textSecondary }}>
                      {e.codigo} • {e.tipo === "externo" ? "Externo" : "Alumno USS"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:mt-0">
                  {proximaAccion === "entrada" ? (
                    <button
                      onClick={() => marcarEntrada(e)}
                      disabled={cargando}
                      className="px-3 py-1 rounded-md text-sm flex items-center gap-1 disabled:opacity-50"
                      style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF' }}
                    >
                      <LogIn size={14} />
                      Entrada
                    </button>
                  ) : (
                    <button
                      onClick={() => marcarSalida(e)}
                      disabled={cargando}
                      className="px-3 py-1 rounded-md text-sm flex items-center gap-1 disabled:opacity-50"
                      style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
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
          <div className="mb-4 p-3 rounded-lg border" style={{ backgroundColor: esDocente ? `${themeStyles.primary}20` : '#DCFCE7', borderColor: esDocente ? themeStyles.textSecondary : '#BBF7D0' }}>
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: esDocente ? themeStyles.primary : '#047857' }} />
              <span className="font-medium" style={{ color: esDocente ? themeStyles.textPrimary : '#065F46' }}>
                {esDocente 
                  ? `Control Sesión ${sesionSeleccionada}: ${estudiantesAsistenciaFiltrados.length} estudiantes (${presentesFiltrados.length} presentes)`
                  : `Estudiantes presentes en aula: ${obtenerEstudiantesPresentes().length}`
                }
              </span>
            </div>
          </div>

          {esDocente ? (
            <div className="space-y-6">
              {estudiantesAsistenciaFiltrados.length === 0 ? (
                <div className="text-center py-8" style={{ color: themeStyles.textSecondary }}>
                  {hayAsistenciasEnSesion 
                    ? "No hay estudiantes con registros en esta sesión."
                    : `No hay registros de asistencia para la sesión ${sesionSeleccionada}.`
                  }
                </div>
              ) : (
                <>
                  {/* Estudiantes Presentes */}
                  {(() => {
                    const estudiantesPresentes = estudiantesAsistenciaFiltrados.filter(estudiante => {
                      const { sessions } = getAllAsistenciaSessions(estudiante);
                      return sessions.length > 0 && sessions[0].isOpen;
                    });

                    return estudiantesPresentes.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: themeStyles.primary }}>
                            <Clock size={18} />
                            Estudiantes Presentes ({estudiantesPresentes.length})
                          </h3>
                        </div>
                        {estudiantesPresentes.map((estudiante) => {
                          const { sessions, totalTime } = getAllAsistenciaSessions(estudiante);
                          const isPresent = sessions.length > 0 && sessions[0].isOpen;
                          const ultimaSesion = sessions[0];

                  return (
                    <div key={estudiante.id} className="rounded-lg border shadow-sm overflow-hidden" style={{ borderColor: themeStyles.textSecondary }}>
                      <div className={`px-4 py-3 border-b`} style={{ backgroundColor: headerBgClass, borderColor: themeStyles.textSecondary }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>
                            <h3 className="text-sm font-semibold" style={{ color: themeStyles.textPrimary }}>{estudiante.nombre}</h3>
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
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-opacity-90 transition-colors"
                                style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF' }}
                              >
                                <Eye size={12} />
                                Ver más
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {ultimaSesion ? (
                        <div className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs" style={{ color: themeStyles.textSecondary }}>
                            <span><strong>Entrada:</strong> {formatDate(ultimaSesion.entry.timestamp)}</span>
                            {ultimaSesion.exit ? (
                              <>
                                <span><strong>Salida:</strong> {formatDate(ultimaSesion.exit.timestamp)}</span>
                                <span className="font-medium" style={{ color: themeStyles.primary }}>{ultimaSesion.duration}</span>
                              </>
                            ) : (
                              <span className="font-medium" style={{ color: '#047857' }}>
                                <Clock size={12} className="inline mr-1" />
                                En curso: {ultimaSesion.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="px-4 py-3 text-sm text-center" style={{ color: themeStyles.textSecondary }}>Sin registros de asistencia</p>
                      )}
                      <div className="px-4 py-2 border-t" style={{ backgroundColor: `${themeStyles.background}80`, borderColor: themeStyles.textSecondary }}>
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium" style={{ color: themeStyles.textSecondary }}>Tiempo total en aula:</span>
                          <span className="font-semibold" style={{ color: themeStyles.primary }}>
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
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border rounded-md shadow-sm" style={{ 
                borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary,
                backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF'
              }}>
                <thead className="text-left" style={{ 
                  backgroundColor: isDarkMode ? '#111827' : `${themeStyles.primary}20`,
                  color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary
                }}>
                  <tr>
                    <th className="px-4 py-2 border-r" style={{ borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary }}>Nombre</th>
                    <th className="px-4 py-2 border-r" style={{ borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary }}>Hora de Entrada</th>
                    <th className="px-4 py-2 border-r" style={{ borderColor: isDarkMode ? '#374151' : themeStyles.textSecondary }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const estudiantesPresentes = obtenerEstudiantesPresentes();
                    if (estudiantesPresentes.length === 0) {
                      return (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center" style={{ color: themeStyles.textSecondary }}>
                            {hayAsistenciasEnSesion 
                              ? "No hay estudiantes presentes en el aula actualmente."
                              : `No hay registros de asistencia para la sesión ${sesionSeleccionada}.`
                            }
                          </td>
                        </tr>
                      );
                    }
                    return estudiantesPresentes.map((estudiante) => {
                      const ultimaEntrada = asistenciasFiltradas
                        .filter((a) => a.codigo === estudiante.codigo && a.accion === "entrada")
                        .sort((a, b) => {
                          const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                          const tb = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                          return tb - ta;
                        })[0];
                      return (
                        <tr key={estudiante.id} className="border-t" style={{ backgroundColor: '#DCFCE7', borderColor: themeStyles.textSecondary }}>
                          <td className="px-4 py-2 text-sm font-semibold border-r" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.textSecondary }}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              {estudiante.nombre}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm border-r" style={{ color: themeStyles.textSecondary, borderColor: themeStyles.textSecondary }}>
                            {ultimaEntrada ? formatDate(ultimaEntrada.timestamp) : "-"}
                          </td>
                          <td className="px-4 py-2 text-sm border-r" style={{ borderColor: themeStyles.textSecondary }}>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-200 text-green-800">
                              <Clock size={12} />
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
          <h3 className="text-lg font-semibold" style={{ color: themeStyles.textPrimary }}>Escanea el Código QR para Registrar</h3>
          <p className="text-sm text-center" style={{ color: themeStyles.textSecondary }}>
            Enfoca la cámara en el QR del estudiante. Se registrará entrada o salida automáticamente para la sesión {sesionSeleccionada}.
          </p>
          <div className="w-full max-w-md border rounded-md overflow-hidden shadow-md" style={{ borderColor: themeStyles.textSecondary }}>
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

      {modal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-6 rounded-lg shadow-xl max-w-sm w-full sm:w-80 border" style={{ backgroundColor: themeStyles.background, borderColor: themeStyles.textSecondary }}>
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
              <p className="text-lg font-semibold text-center" style={{ color: themeStyles.textPrimary }}>
                {modal.mensaje.includes("Error") || modal.mensaje.includes("invalido")
                  ? modal.mensaje
                  : `${modal.accion.charAt(0).toUpperCase() + modal.accion.slice(1)} registrada para ${modal.nombre}`}
              </p>
              <p className="text-sm text-center" style={{ color: themeStyles.textSecondary }}>
                {modal.mensaje.includes("Error") || modal.mensaje.includes("invalido")
                  ? ""
                  : `Sesión ${sesionSeleccionada}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {modalHistorial.show && modalHistorial.estudiante && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden" style={getContainerStyles()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF' }}>
              <div>
                <h2 className="text-lg font-semibold">Historial de Asistencia</h2>
                <p className="text-sm opacity-90">{modalHistorial.estudiante.nombre} - Sesión {sesionSeleccionada}</p>
              </div>
              <button
                onClick={cerrarHistorial}
                className="hover:text-opacity-80 transition-colors"
                style={{ color: '#FFFFFF' }}
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {(() => {
                const { sessions, totalTime } = getAllAsistenciaSessions(modalHistorial.estudiante);
                if (sessions.length === 0) {
                  return (
                    <p className="text-center py-8" style={{ color: themeStyles.textSecondary }}>Sin registros de asistencia</p>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: `${themeStyles.primary}20`, borderColor: themeStyles.textSecondary }}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium" style={{ color: themeStyles.textSecondary }}>Total de sesiones:</span>
                        <span className="font-semibold" style={{ color: themeStyles.primary }}>{sessions.length}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-medium" style={{ color: themeStyles.textSecondary }}>Tiempo total acumulado:</span>
                        <span className="font-semibold" style={{ color: themeStyles.primary }}>
                          <Clock size={16} className="inline mr-1" />
                          {totalTime}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium border-b pb-2" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.textSecondary }}>
                        Registro detallado (más reciente primero):
                      </h3>
                      {sessions.map((session, index) => {
                        const isOpen = session.isOpen;
                        return (
                          <div key={index} className="border rounded-lg p-4" style={{ backgroundColor: isOpen ? '#DCFCE7' : `${themeStyles.background}80`, borderColor: themeStyles.textSecondary }}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium" style={{ color: isDarkMode ? '#F9FAFB' : themeStyles.textPrimary }}>Sesión {index + 1}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isOpen ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'
                              }`}>
                                {isOpen ? 'Presente' : 'Completada'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium" style={{ color: themeStyles.textSecondary }}>Entrada:</span>
                                <p style={{ color: themeStyles.textPrimary }}>{formatDate(session.entry.timestamp)}</p>
                              </div>
                              <div>
                                <span className="font-medium" style={{ color: themeStyles.textSecondary }}>Salida:</span>
                                <p style={{ color: themeStyles.textPrimary }}>
                                  {session.exit ? formatDate(session.exit.timestamp) : 'En curso...'}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium" style={{ color: themeStyles.textSecondary }}>Duración:</span>
                                <p className={`font-medium ${isOpen ? 'text-green-600' : ''}`} style={{ color: isOpen ? '#047857' : themeStyles.primary }}>
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
            <div className="px-6 py-3 border-t" style={{ backgroundColor: `${themeStyles.background}80`, borderColor: themeStyles.textSecondary }}>
              <button
                onClick={cerrarHistorial}
                className="w-full py-2 px-4 rounded-md transition-colors"
                style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {cargandoMasivo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-6 rounded-lg shadow-lg border" style={{ backgroundColor: themeStyles.background, borderColor: themeStyles.textSecondary }}>
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: themeStyles.primary }}></div>
              <span style={{ color: themeStyles.textPrimary }}>Procesando registros masivos...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}