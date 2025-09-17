import { useState, useEffect } from "react";
import FormularioRegistro from "./components/FormularioRegistro";
import FormularioDocente from "./components/FormularioDocente";
import MarcarAsistencia from "./components/MarcarAsistencia";
import Reportes from "./components/Reportes";
import ListadoAsistencias from "./components/ListadoAsistencias";
import ListaEstudiantes from "./components/ListaEstudiantes";
import { PlusCircle, Settings, UserPlus, LogOut, BarChart3, ClipboardCheck, User, Users, Menu, X } from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "../src/firebase";

function App() {
  const [mostrarModalRegistro, setMostrarModalRegistro] = useState(false);
  const [mostrarModalAdmin, setMostrarModalAdmin] = useState(false);
  const [mostrarModalDocente, setMostrarModalDocente] = useState(false);
  const [dni, setDni] = useState("");
  const [error, setError] = useState("");
  const [esDocenteAutenticado, setEsDocenteAutenticado] = useState(() => {
    const savedAuth = localStorage.getItem('docenteAutenticado');
    return savedAuth === 'true';
  });
  const [docenteInfo, setDocenteInfo] = useState(() => {
    const savedDocente = localStorage.getItem('docenteInfo');
    return savedDocente ? JSON.parse(savedDocente) : null;
  });
  const [vistaAdmin, setVistaAdmin] = useState("home");
  const [filtroFecha, setFiltroFecha] = useState("hoy");
  const [filtroHora, setFiltroHora] = useState("");
  const [vista, setVista] = useState("principal");
  const [sidebarColapsado, setSidebarColapsado] = useState(window.innerWidth < 1024);

  // Función para verificar si la sesión ha expirado
  const verificarExpiracionSesion = () => {
    const ultimaActividad = localStorage.getItem('ultimaActividad');
    const tiempoLimite = 10 * 60 * 1000; // 10 minutos en milisegundos
    
    if (ultimaActividad) {
      const tiempoTranscurrido = Date.now() - parseInt(ultimaActividad);
      
      if (tiempoTranscurrido > tiempoLimite) {
        // La sesión ha expirado
        localStorage.removeItem('docenteAutenticado');
        localStorage.removeItem('docenteInfo');
        localStorage.removeItem('ultimaActividad');
        setEsDocenteAutenticado(false);
        setDocenteInfo(null);
        setVista("principal");
        setVistaAdmin("home");
        setSidebarColapsado(window.innerWidth < 1024);
        return true; // Sesión expirada
      }
    }
    return false; // Sesión válida
  };

  // Función para actualizar la última actividad
  const actualizarUltimaActividad = () => {
    localStorage.setItem('ultimaActividad', Date.now().toString());
  };

  // Restaurar sesión desde localStorage al cargar la página
  useEffect(() => {
    const savedAuth = localStorage.getItem('docenteAutenticado');
    const savedDocente = localStorage.getItem('docenteInfo');
    
    if (savedAuth === 'true' && savedDocente) {
      // Verificar si la sesión ha expirado antes de restaurarla
      if (!verificarExpiracionSesion()) {
        setEsDocenteAutenticado(true);
        setDocenteInfo(JSON.parse(savedDocente));
        // Actualizar la actividad al cargar la página
        actualizarUltimaActividad();
      }
    }
  }, []);

  // Manejar el cierre de la página/pestaña
  useEffect(() => {
    const manejarCierrePagina = () => {
      if (esDocenteAutenticado) {
        // Guardar timestamp cuando se cierra la página
        localStorage.setItem('ultimaActividad', Date.now().toString());
      }
    };

    // Escuchar cuando se va a cerrar la página/pestaña
    window.addEventListener('beforeunload', manejarCierrePagina);
    
    return () => {
      window.removeEventListener('beforeunload', manejarCierrePagina);
    };
  }, [esDocenteAutenticado]);

  // Verificar periodicamente si la sesión ha expirado (cada minuto)
  useEffect(() => {
    if (esDocenteAutenticado) {
      const intervalo = setInterval(() => {
        verificarExpiracionSesion();
      }, 60000); // Verificar cada minuto

      return () => clearInterval(intervalo);
    }
  }, [esDocenteAutenticado]);

  // Actualizar última actividad en interacciones del usuario
  useEffect(() => {
    const actualizarActividad = () => {
      if (esDocenteAutenticado) {
        actualizarUltimaActividad();
      }
    };

    // Escuchar clicks, movimientos del mouse, teclas presionadas
    const eventos = ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    eventos.forEach(evento => {
      document.addEventListener(evento, actualizarActividad);
    });

    return () => {
      eventos.forEach(evento => {
        document.removeEventListener(evento, actualizarActividad);
      });
    };
  }, [esDocenteAutenticado]);

  // Inicializar sidebarColapsado según el tamaño de pantalla y escuchar cambios
  useEffect(() => {
    const handleResize = () => {
      setSidebarColapsado(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!dni || dni.length !== 8) {
      setError("⚠️ Ingresa un DNI válido de 8 dígitos");
      return;
    }
    try {
      const q = query(collection(db, "docentes"), where("dni", "==", dni));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setError("❌ DNI no registrado como docente");
        setDni("");
        return;
      }
      const docenteData = snapshot.docs[0].data();
      if (docenteData.rol === "docente") {
        console.log("✅ Acceso administrativo concedido para:", docenteData.nombre);
        setDocenteInfo(docenteData);
        setEsDocenteAutenticado(true);
        setVistaAdmin("home");
        setVista("principal");
        setDni("");
        setMostrarModalAdmin(false);
        
        // Guardar en localStorage para persistencia y establecer la actividad inicial
        localStorage.setItem('docenteAutenticado', 'true');
        localStorage.setItem('docenteInfo', JSON.stringify(docenteData));
        actualizarUltimaActividad();
      } else {
        setError("❌ No tienes permisos de docente");
        setDni("");
      }
    } catch (err) {
      console.error("Error validando DNI:", err);
      setError("❌ Error al validar. Intenta de nuevo.");
    }
  };

  const handleCancelar = () => {
    setDni("");
    setError("");
    setMostrarModalAdmin(false);
  };

  const cerrarSesionDocente = () => {
    setEsDocenteAutenticado(false);
    setDocenteInfo(null);
    setVista("principal");
    setVistaAdmin("home");
    setSidebarColapsado(window.innerWidth < 1024);
    
    // Limpiar localStorage al cerrar sesión manualmente
    localStorage.removeItem('docenteAutenticado');
    localStorage.removeItem('docenteInfo');
    localStorage.removeItem('ultimaActividad');
  };

  const toggleSidebar = () => {
    setSidebarColapsado(!sidebarColapsado);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        {/* Título solo para vista principal sin autenticar */}
        {vista === "principal" && !esDocenteAutenticado && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 text-center text-sky-900 tracking-tight pt-6">
            Asistencia Estudiantes USS
          </h1>
        )}

        {/* Vista principal para no autenticados */}
        {vista === "principal" && !esDocenteAutenticado && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-end mb-6 gap-3 sm:gap-4 pr-4 sm:pr-6 md:pr-8">
              <button
                onClick={() => setMostrarModalRegistro(true)}
                className="flex items-center gap-2 bg-sky-700 text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg shadow-md hover:bg-sky-800 transition-all duration-200 text-sm sm:text-base font-medium"
              >
                <PlusCircle size={22} />
                Agregar estudiante
              </button>
              <button
                onClick={() => setMostrarModalAdmin(true)}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg shadow-md hover:bg-amber-700 transition-all duration-200 text-sm sm:text-base font-medium"
              >
                <Settings size={22} />
                Administrar
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
              <MarcarAsistencia esDocente={esDocenteAutenticado} />
            </div>
          </div>
        )}

        {/* Vista para docentes autenticados */}
        {esDocenteAutenticado && (
          <div className="flex min-h-screen relative">
            {/* Backdrop para mobile/tablet cuando el sidebar está abierto */}
            {!sidebarColapsado && (
              <div
                className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
                onClick={toggleSidebar}
              />
            )}

            {/* Sidebar flotante en mobile/tablet, fijo en desktop */}
            <aside className={`fixed top-0 left-0 h-full bg-gradient-to-br from-sky-800 to-sky-900 shadow-2xl z-50 transition-all duration-300 ease-in-out ${
              sidebarColapsado 
                ? 'w-64 -translate-x-full lg:w-16 lg:translate-x-0' 
                : 'w-64 lg:w-72'
            }`}>
              {/* Botón hamburguesa para desktop/laptop (dentro del sidebar) */}
              <div className="p-4 border-b border-sky-600 hidden lg:block">
                <button
                  onClick={toggleSidebar}
                  className="w-full flex items-center justify-center p-2 rounded-lg text-white hover:bg-sky-700/50 transition-all duration-200"
                  title={sidebarColapsado ? "Expandir menú" : "Colapsar menú"}
                >
                  {sidebarColapsado ? <Menu size={24} /> : <X size={24} />}
                </button>
              </div>

              {/* Header del panel - Solo visible cuando no está colapsado */}
              {!sidebarColapsado && (
                <div className="mb-8 pb-6 border-b border-sky-600 px-4">
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 text-center mt-4">Panel Docente</h3>
                  
                  {/* Información del docente */}
                  <div className="bg-sky-700/50 rounded-lg p-4 backdrop-blur-sm text-center">
                    <div className="bg-white/20 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <User size={32} className="text-white" />
                    </div>
                    <p className="text-white font-medium text-sm truncate">
                      {docenteInfo?.nombre || 'Docente'}
                    </p>
                  </div>
                </div>
              )}

              {/* Navegación */}
              <nav className={`space-y-3 ${sidebarColapsado ? 'px-2' : 'px-4'}`}>
                <button
                  onClick={() => {setVistaAdmin("home"); setVista("principal");}}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "home" 
                      ? "bg-sky-600 text-white shadow-md" 
                      : "text-sky-100 hover:bg-sky-700/50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  title={sidebarColapsado ? "Home" : ""}
                >
                  <User size={20} />
                  {!sidebarColapsado && "Home"}
                </button>
                <button
                  onClick={() => {setVistaAdmin("reportes"); setVista("admin");}}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "reportes" 
                      ? "bg-sky-600 text-white shadow-md" 
                      : "text-sky-100 hover:bg-sky-700/50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  title={sidebarColapsado ? "Reportes" : ""}
                >
                  <BarChart3 size={20} />
                  {!sidebarColapsado && "Reportes"}
                </button>
                <button
                  onClick={() => {setVistaAdmin("listado"); setVista("admin");}}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "listado" 
                      ? "bg-sky-600 text-white shadow-md" 
                      : "text-sky-100 hover:bg-sky-700/50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  title={sidebarColapsado ? "Listado" : ""}
                >
                  <ClipboardCheck size={20} />
                  {!sidebarColapsado && "Listado de Asistencias"}
                </button>
                <button
                  onClick={() => {setVistaAdmin("docentes"); setVista("admin");}}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "docentes" 
                      ? "bg-sky-600 text-white shadow-md" 
                      : "text-sky-100 hover:bg-sky-700/50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  title={sidebarColapsado ? "Lista de Docentes" : ""}
                >
                  <UserPlus size={20} />
                  {!sidebarColapsado && "Lista de Docentes"}
                </button>
                <button
                  onClick={() => {setVistaAdmin("estudiantes"); setVista("admin");}}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "estudiantes" 
                      ? "bg-sky-600 text-white shadow-md" 
                      : "text-sky-100 hover:bg-sky-700/50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  title={sidebarColapsado ? "Listado de Estudiantes" : ""}
                >
                  <Users size={20} />
                  {!sidebarColapsado && "Listado de Estudiantes"}
                </button>
                
                {/* Separador */}
                <div className="border-t border-sky-600 my-4"></div>
                
                <button
                  onClick={cerrarSesionDocente}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium text-sky-100 hover:bg-red-600/80 hover:text-white transition-all duration-200 ${sidebarColapsado ? 'justify-center' : ''}`}
                  title={sidebarColapsado ? "Cerrar sesión" : ""}
                >
                  <LogOut size={20} />
                  {!sidebarColapsado && "Cerrar sesión"}
                </button>
              </nav>
            </aside>
            
            {/* Botón flotante para mobile/tablet, siempre visible */}
            {esDocenteAutenticado && (
              <button
                onClick={toggleSidebar}
                className={`lg:hidden fixed top-16 z-50 w-12 h-12 flex items-center justify-center bg-sky-700 text-white rounded-full shadow-lg hover:bg-sky-800 transition-all duration-300 ease-in-out ${
                  sidebarColapsado ? 'left-4' : 'left-64'
                }`}
                title={sidebarColapsado ? "Abrir menú" : "Cerrar menú"}
              >
                {sidebarColapsado ? <Menu size={24} /> : <X size={24} />}
              </button>
            )}

            {/* Contenido principal con margen dinámico solo en desktop */}
            <main className={`flex-1 min-h-screen transition-all duration-300 ease-in-out ${
              sidebarColapsado ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-72'
            }`}>
              {/* Título fijo en la parte superior para docentes */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
                <h1 className="text-2xl sm:text-3xl font-bold text-sky-900 tracking-tight">
                  Asistencia Estudiantes USS
                </h1>
              </div>

              {/* Vista principal para docentes */}
              {vista === "principal" && (
                <div className="p-6">
                  <div className="flex justify-end mb-6 gap-3">
                    <button
                      onClick={() => setMostrarModalRegistro(true)}
                      className="flex items-center gap-2 bg-sky-700 text-white px-4 py-2.5 rounded-lg shadow-md hover:bg-sky-800 transition-all duration-200 text-sm sm:text-base font-medium"
                    >
                      <PlusCircle size={22} />
                      Agregar estudiante
                    </button>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <MarcarAsistencia esDocente={true} />
                  </div>
                </div>
              )}

              {/* Otras vistas admin */}
              {vista === "admin" && (
                <div className="p-6">
                  {vistaAdmin === "reportes" && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <Reportes
                        filtroFecha={filtroFecha}
                        setFiltroFecha={setFiltroFecha}
                        filtroHora={filtroHora}
                        setFiltroHora={setFiltroHora}
                        asistencias={[]}
                      />
                    </div>
                  )}
                  {vistaAdmin === "listado" && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <ListadoAsistencias
                        filtroFecha={filtroFecha}
                        setFiltroFecha={setFiltroFecha}
                        filtroHora={filtroHora}
                        setFiltroHora={setFiltroHora}
                        asistencias={[]}
                      />
                    </div>
                  )}
                  {vistaAdmin === "docentes" && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <FormularioDocente showFormAsModal={false} onOpenModal={() => setMostrarModalDocente(true)} />
                    </div>
                  )}
                  {vistaAdmin === "estudiantes" && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <ListaEstudiantes />
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        )}

        {mostrarModalRegistro && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 sm:px-6">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg sm:max-w-xl border border-gray-200">
              <FormularioRegistro onClose={() => setMostrarModalRegistro(false)} />
            </div>
          </div>
        )}

        {mostrarModalAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 sm:px-6">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg sm:max-w-xl border border-gray-200">
              <h2 className="text-xl sm:text-2xl font-semibold text-sky-900 mb-6 text-center">Acceso Administrativo</h2>
              {error && (
                <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
              )}
              <form onSubmit={handleAdminSubmit} className="space-y-6">
                <div>
                  <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-2">
                    DNI Docente
                  </label>
                  <input
                    type="password"
                    id="dni"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="********"
                    maxLength={8}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleCancelar}
                    className="px-4 sm:px-5 py-2.5 text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-200 text-sm sm:text-base"
                  >
                    Cerrar
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-4 sm:px-5 py-2.5 bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition-all duration-200 text-sm sm:text-base"
                    >
                      Acceder
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {mostrarModalDocente && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 sm:px-6">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg sm:max-w-xl border border-gray-200">
              <FormularioDocente showFormAsModal={true} onClose={() => setMostrarModalDocente(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;