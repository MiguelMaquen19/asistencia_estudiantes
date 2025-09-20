import { useState, useEffect } from "react";
import FormularioRegistro from "./components/FormularioRegistro";
import FormularioDocente from "./components/FormularioDocente";
import MarcarAsistencia from "./components/MarcarAsistencia";
import Reportes from "./components/Reportes";
import ListadoAsistencias from "./components/ListadoAsistencias";
import ListaEstudiantes from "./components/ListaEstudiantes";
import {
  PlusCircle,
  Settings,
  UserPlus,
  LogOut,
  BarChart3,
  ClipboardCheck,
  User,
  Users,
  Menu,
  X,
  Palette,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "../src/firebase";

// Definir los temas
export const themes = {
  blue: {
    primary: '#1E3A8A',
    secondary: '#3B82F6',
    background: '#F0F4F8',
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    name: 'Azul'
  },
  gray: {
    primary: '#4B5563',
    secondary: '#6B7280',
    background: '#F3F4F6',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    name: 'Gris'
  },
  green: {
    primary: '#065F46',
    secondary: '#34D399',
    background: '#ECFDF5',
    textPrimary: '#111827',
    textSecondary: '#064E3B',
    name: 'Verde'
  },
  purple: {
    primary: '#5B21B6',
    secondary: '#8B5CF6',
    background: '#F5F3FF',
    textPrimary: '#111827',
    textSecondary: '#6D28D9',
    name: 'Púrpura'
  },
  indigo: {
    primary: '#312E81',
    secondary: '#6366F1',
    background: '#EEF2FF',
    textPrimary: '#111827',
    textSecondary: '#4F46E5',
    name: 'Índigo'
  },
};

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
  const [selectedTheme, setSelectedTheme] = useState(() => {
    return localStorage.getItem('selectedTheme') || 'blue';
  });

  // Estados para los menús desplegables del header
  const [mostrarMenuTemas, setMostrarMenuTemas] = useState(false);
  const [mostrarMenuOpciones, setMostrarMenuOpciones] = useState(false);

  useEffect(() => {
    localStorage.setItem('selectedTheme', selectedTheme);
  }, [selectedTheme]);

  // Funciones existentes (mantengo las mismas)
  const verificarExpiracionSesion = () => {
    const ultimaActividad = localStorage.getItem('ultimaActividad');
    const tiempoLimite = 10 * 60 * 1000;
    if (ultimaActividad) {
      const tiempoTranscurrido = Date.now() - parseInt(ultimaActividad);
      if (tiempoTranscurrido > tiempoLimite) {
        localStorage.removeItem('docenteAutenticado');
        localStorage.removeItem('docenteInfo');
        localStorage.removeItem('ultimaActividad');
        setEsDocenteAutenticado(false);
        setDocenteInfo(null);
        setVista("principal");
        setVistaAdmin("home");
        setSidebarColapsado(window.innerWidth < 1024);
        return true;
      }
    }
    return false;
  };

  const actualizarUltimaActividad = () => {
    localStorage.setItem('ultimaActividad', Date.now().toString());
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem('docenteAutenticado');
    const savedDocente = localStorage.getItem('docenteInfo');
    if (savedAuth === 'true' && savedDocente) {
      if (!verificarExpiracionSesion()) {
        setEsDocenteAutenticado(true);
        setDocenteInfo(JSON.parse(savedDocente));
        actualizarUltimaActividad();
      }
    }
  }, []);

  useEffect(() => {
    const manejarCierrePagina = () => {
      if (esDocenteAutenticado) {
        localStorage.setItem('ultimaActividad', Date.now().toString());
      }
    };
    window.addEventListener('beforeunload', manejarCierrePagina);
    return () => window.removeEventListener('beforeunload', manejarCierrePagina);
  }, [esDocenteAutenticado]);

  useEffect(() => {
    if (esDocenteAutenticado) {
      const intervalo = setInterval(() => {
        verificarExpiracionSesion();
      }, 60000);
      return () => clearInterval(intervalo);
    }
  }, [esDocenteAutenticado]);

  useEffect(() => {
    const actualizarActividad = () => {
      if (esDocenteAutenticado) {
        actualizarUltimaActividad();
      }
    };
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

  useEffect(() => {
    const handleResize = () => {
      setSidebarColapsado(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cerrar menús cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.menu-dropdown')) {
        setMostrarMenuTemas(false);
        setMostrarMenuOpciones(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
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
    localStorage.removeItem('docenteAutenticado');
    localStorage.removeItem('docenteInfo');
    localStorage.removeItem('ultimaActividad');
  };

  const toggleSidebar = () => {
    setSidebarColapsado(!sidebarColapsado);
  };

  const handleThemeChange = (theme) => {
    setSelectedTheme(theme);
    setMostrarMenuTemas(false);
  };

  const themeStyles = themes[selectedTheme];

  // Componente del Header
  const Header = () => (
    <header
      className="sticky top-0 z-50 bg-white shadow-lg border-b"
      style={{ borderColor: themeStyles.textSecondary }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo/Título */}
          <div className="flex items-center space-x-4">
            {esDocenteAutenticado && (
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: themeStyles.primary }}
              >
                <Menu size={24} />
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: themeStyles.textPrimary }}>
              <span className="hidden sm:inline">Asistencia Estudiantes USS</span>
              <span className="sm:hidden">USS Asistencia</span>
            </h1>
          </div>

          {/* Controles del header */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Selector de temas */}
            <div className="relative menu-dropdown">
              <button
                onClick={() => {
                  setMostrarMenuTemas(!mostrarMenuTemas);
                  setMostrarMenuOpciones(false);
                }}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                style={{ color: themeStyles.primary }}
                title="Cambiar tema"
              >
                <Palette size={20} />
                <span className="hidden sm:inline text-sm font-medium">Tema</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${mostrarMenuTemas ? 'rotate-180' : ''}`}
                />
              </button>

              {mostrarMenuTemas && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    Seleccionar Tema
                  </div>
                  {Object.entries(themes).map(([themeKey, theme]) => (
                    <button
                      key={themeKey}
                      onClick={() => handleThemeChange(themeKey)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedTheme === themeKey ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {theme.name}
                      </span>
                      {selectedTheme === themeKey && (
                        <div className="ml-auto">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primary }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menú de opciones (solo para no autenticados) */}
            {!esDocenteAutenticado && (
              <div className="relative menu-dropdown">
                <button
                  onClick={() => {
                    setMostrarMenuOpciones(!mostrarMenuOpciones);
                    setMostrarMenuTemas(false);
                  }}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  style={{ color: themeStyles.primary }}
                  title="Opciones"
                >
                  <Settings size={20} />
                  <span className="hidden sm:inline text-sm font-medium">Opciones</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${mostrarMenuOpciones ? 'rotate-180' : ''}`}
                  />
                </button>

                {mostrarMenuOpciones && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      Acciones
                    </div>
                    <button
                      onClick={() => {
                        setMostrarModalRegistro(true);
                        setMostrarMenuOpciones(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <PlusCircle size={18} style={{ color: themeStyles.primary }} />
                      <span className="text-sm font-medium text-gray-700">Agregar Estudiante</span>
                    </button>
                    <button
                      onClick={() => {
                        setMostrarModalAdmin(true);
                        setMostrarMenuOpciones(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <Settings size={18} style={{ color: themeStyles.secondary }} />
                      <span className="text-sm font-medium text-gray-700">Panel Administrativo</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Botón de agregar estudiante para docentes autenticados */}
            {esDocenteAutenticado && vista === "principal" && (
              <button
                onClick={() => setMostrarModalRegistro(true)}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg shadow-md transition-all duration-200 text-sm font-medium"
                style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF' }}
              >
                <PlusCircle size={18} />
                <span className="hidden sm:inline">Agregar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: themeStyles.background }}>
      <div className="w-full">
        {/* Header siempre visible */}
        <Header />

        {/* Vista principal para no autenticados */}
        {vista === "principal" && !esDocenteAutenticado && (
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
              <MarcarAsistencia esDocente={esDocenteAutenticado} theme={selectedTheme} />
            </div>
          </div>
        )}

        {/* Vista para docentes autenticados */}
        {esDocenteAutenticado && (
          <div className="flex min-h-screen relative">
            {/* Backdrop para mobile/tablet */}
            {!sidebarColapsado && (
              <div
                className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
                onClick={toggleSidebar}
                style={{ top: '5rem' }}
              />
            )}

            {/* Sidebar */}
            <aside
              className={`fixed h-full shadow-2xl z-50 transition-all duration-300 ease-in-out ${
                sidebarColapsado
                  ? 'w-64 -translate-x-full lg:w-16 lg:translate-x-0'
                  : 'w-64 lg:w-72'
              }`}
              style={{
                background: `linear-gradient(to bottom right, ${themeStyles.primary}, ${themeStyles.secondary})`,
                top: '5rem'
              }}
            >
              <div className="p-4 border-b" style={{ borderColor: themeStyles.textSecondary }}>
                <button
                  onClick={toggleSidebar}
                  className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-opacity-50 transition-all duration-200 lg:hidden"
                  style={{ color: '#FFFFFF' }}
                  title="Cerrar menú"
                >
                  <X size={24} />
                </button>
              </div>

              {!sidebarColapsado && (
                <div className="mb-8 pb-6 border-b px-4" style={{ borderColor: themeStyles.textSecondary }}>
                  <h3 className="text-lg sm:text-xl font-semibold mb-4 text-center mt-4" style={{ color: '#FFFFFF' }}>
                    Panel Docente
                  </h3>
                  <div className="rounded-lg p-4 backdrop-blur-sm text-center" style={{ backgroundColor: `${themeStyles.primary}33` }}>
                    <div className="bg-white/20 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <User size={32} className="text-white" />
                    </div>
                    <p className="font-medium text-sm truncate" style={{ color: '#FFFFFF' }}>
                      {docenteInfo?.nombre || 'Docente'}
                    </p>
                  </div>
                </div>
              )}

              <nav className={`space-y-3 ${sidebarColapsado ? 'px-2' : 'px-4'}`}>
                <button
                  onClick={() => { setVistaAdmin("home"); setVista("principal"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "home"
                      ? "shadow-md"
                      : "hover:bg-opacity-50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  style={{
                    backgroundColor: vistaAdmin === "home" ? themeStyles.secondary : 'transparent',
                    color: '#FFFFFF',
                  }}
                  title={sidebarColapsado ? "Home" : ""}
                >
                  <User size={20} />
                  {!sidebarColapsado && "Home"}
                </button>
                <button
                  onClick={() => { setVistaAdmin("reportes"); setVista("admin"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "reportes"
                      ? "shadow-md"
                      : "hover:bg-opacity-50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  style={{
                    backgroundColor: vistaAdmin === "reportes" ? themeStyles.secondary : 'transparent',
                    color: '#FFFFFF',
                  }}
                  title={sidebarColapsado ? "Reportes" : ""}
                >
                  <BarChart3 size={20} />
                  {!sidebarColapsado && "Reportes"}
                </button>
                <button
                  onClick={() => { setVistaAdmin("listado"); setVista("admin"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "listado"
                      ? "shadow-md"
                      : "hover:bg-opacity-50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  style={{
                    backgroundColor: vistaAdmin === "listado" ? themeStyles.secondary : 'transparent',
                    color: '#FFFFFF',
                  }}
                  title={sidebarColapsado ? "Listado" : ""}
                >
                  <ClipboardCheck size={20} />
                  {!sidebarColapsado && "Listado de Asistencias"}
                </button>
                <button
                  onClick={() => { setVistaAdmin("docentes"); setVista("admin"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "docentes"
                      ? "shadow-md"
                      : "hover:bg-opacity-50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  style={{
                    backgroundColor: vistaAdmin === "docentes" ? themeStyles.secondary : 'transparent',
                    color: '#FFFFFF',
                  }}
                  title={sidebarColapsado ? "Lista de Docentes" : ""}
                >
                  <UserPlus size={20} />
                  {!sidebarColapsado && "Lista de Docentes"}
                </button>
                <button
                  onClick={() => { setVistaAdmin("estudiantes"); setVista("admin"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 ${
                    vistaAdmin === "estudiantes"
                      ? "shadow-md"
                      : "hover:bg-opacity-50 hover:text-white"
                  } ${sidebarColapsado ? 'justify-center' : ''}`}
                  style={{
                    backgroundColor: vistaAdmin === "estudiantes" ? themeStyles.secondary : 'transparent',
                    color: '#FFFFFF',
                  }}
                  title={sidebarColapsado ? "Listado de Estudiantes" : ""}
                >
                  <Users size={20} />
                  {!sidebarColapsado && "Listado de Estudiantes"}
                </button>
                <div className="border-t my-4" style={{ borderColor: themeStyles.textSecondary }}></div>
                <button
                  onClick={cerrarSesionDocente}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 hover:bg-red-500/20 ${sidebarColapsado ? 'justify-center' : ''}`}
                  style={{
                    color: '#FFFFFF',
                    backgroundColor: 'transparent',
                  }}
                  title={sidebarColapsado ? "Cerrar sesión" : ""}
                >
                  <LogOut size={20} />
                  {!sidebarColapsado && "Cerrar sesión"}
                </button>
              </nav>
            </aside>

            {/* Contenido principal */}
            <main className={`flex-1 min-h-screen transition-all duration-300 ease-in-out ${
              sidebarColapsado ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-72'
            }`}>
              {vista === "principal" && (
                <div className="p-4 sm:p-6">
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <MarcarAsistencia esDocente={true} theme={selectedTheme} />
                  </div>
                </div>
              )}

              {vista === "admin" && (
                <div className="p-4 sm:p-6">
                  {vistaAdmin === "reportes" && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <Reportes
                        filtroFecha={filtroFecha}
                        setFiltroFecha={setFiltroFecha}
                        filtroHora={filtroHora}
                        setFiltroHora={setFiltroHora}
                        asistencias={[]}
                        selectedTheme={selectedTheme}
                        themes={themes}
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
                        selectedTheme={selectedTheme}
                      />
                    </div>
                  )}
                  {vistaAdmin === "docentes" && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <FormularioDocente
                        showFormAsModal={false}
                        onOpenModal={() => setMostrarModalDocente(true)}
                        selectedTheme={selectedTheme}
                        themes={themes}
                      />
                    </div>
                  )}
                  {vistaAdmin === "estudiantes" && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <ListaEstudiantes selectedTheme={selectedTheme} themes={themes} />
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        )}

        {/* Modales */}
        {mostrarModalRegistro && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 sm:px-6">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg sm:max-w-xl border" style={{ borderColor: themeStyles.textSecondary }}>
              <FormularioRegistro
                onClose={() => setMostrarModalRegistro(false)}
                userRole={docenteInfo?.rol || null}
                isLoggedIn={esDocenteAutenticado}
                selectedTheme={selectedTheme}
                themes={themes}
              />
            </div>
          </div>
        )}

        {mostrarModalAdmin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 sm:px-6">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg sm:max-w-xl border" style={{ borderColor: themeStyles.textSecondary }}>
              <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-center" style={{ color: themeStyles.textPrimary }}>
                Acceso Administrativo
              </h2>
              {error && (
                <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
              )}
              <form onSubmit={handleAdminSubmit} className="space-y-6">
                <div>
                  <label htmlFor="dni" className="block text-sm font-medium mb-2" style={{ color: themeStyles.textPrimary }}>
                    DNI Docente
                  </label>
                  <input
                    type="password"
                    id="dni"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2"
                    style={{ borderColor: themeStyles.textSecondary, focusRingColor: themeStyles.secondary }}
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
                    className="px-4 sm:px-5 py-2.5 rounded-lg hover:bg-gray-100 transition-all duration-200 text-sm sm:text-base"
                    style={{ color: themeStyles.textPrimary }}
                  >
                    Cerrar
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-4 sm:px-5 py-2.5 rounded-lg transition-all duration-200 text-sm sm:text-base"
                      style={{ backgroundColor: themeStyles.primary, color: '#FFFFFF' }}
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
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg sm:max-w-xl border" style={{ borderColor: themeStyles.textSecondary }}>
              <FormularioDocente
                showFormAsModal={true}
                onClose={() => setMostrarModalDocente(false)}
                selectedTheme={selectedTheme}
                themes={themes}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;