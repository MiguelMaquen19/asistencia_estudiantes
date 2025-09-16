import { useEffect, useState } from "react";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { GraduationCap, Users, QrCode, Download, RefreshCw, Eye, EyeOff } from "lucide-react";
import QRCodeGenerator from "qrcode";

export default function ListaEstudiantes() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargandoQR, setCargandoQR] = useState({});
  const [qrExpandido, setQrExpandido] = useState({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "estudiantes"), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data()
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
    link.download = `QR_${estudiante.codigo}_${estudiante.nombre.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarMensaje(`QR de ${estudiante.nombre} descargado correctamente`);
  };

  const generarQR = async (estudiante) => {
    try {
      setCargandoQR(prev => ({ ...prev, [estudiante.id]: true }));
      mostrarMensaje("Generando código QR...");
      
      const qrDataUrl = await QRCodeGenerator.toDataURL(estudiante.codigo, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
        color: { dark: "#0f172a", light: "#ffffff" },
      });

      await updateDoc(doc(db, "estudiantes", estudiante.id), {
        qrImage: qrDataUrl,
        qrGenerado: true,
        fechaQR: new Date()
      });

      mostrarMensaje(`Código QR generado para ${estudiante.nombre}`);
    } catch (error) {
      console.error("Error al generar QR:", error);
      mostrarMensaje("Error al generar el código QR");
    } finally {
      setCargandoQR(prev => ({ ...prev, [estudiante.id]: false }));
    }
  };

  const regenerarQR = async (estudiante) => {
    try {
      setCargandoQR(prev => ({ ...prev, [estudiante.id]: true }));
      mostrarMensaje("Regenerando código QR...");
      
      const qrDataUrl = await QRCodeGenerator.toDataURL(estudiante.codigo, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
        color: { dark: "#0f172a", light: "#ffffff" },
      });

      await updateDoc(doc(db, "estudiantes", estudiante.id), {
        qrImage: qrDataUrl,
        fechaQR: new Date()
      });

      mostrarMensaje(`Código QR regenerado para ${estudiante.nombre}`);
    } catch (error) {
      console.error("Error al regenerar QR:", error);
      mostrarMensaje("Error al regenerar el código QR");
    } finally {
      setCargandoQR(prev => ({ ...prev, [estudiante.id]: false }));
    }
  };

  const toggleQR = (estudianteId) => {
    setQrExpandido(prev => ({
      ...prev,
      [estudianteId]: !prev[estudianteId]
    }));
  };

  const filteredEstudiantes = estudiantes.filter((e) =>
    e.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.curso?.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.escuela?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Encabezado bonito y colorido - igual al FormularioDocente */}
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-sky-900 flex items-center gap-2">
            <GraduationCap size={20} className="text-sky-700" />
            <span className="hidden sm:inline">Listado de Estudiantes</span>
            <span className="sm:hidden">Estudiantes</span>
            <span className="text-sm sm:text-base text-sky-600">({estudiantes.length})</span>
          </h2>
        </div>

        <input
          type="text"
          placeholder="Buscar por nombre, código, curso o escuela..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2.5 sm:p-3 mb-4 sm:mb-6 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm sm:text-base"
        />

        {mensaje && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-center text-blue-800">{mensaje}</p>
          </div>
        )}

        {filteredEstudiantes.length === 0 ? (
          <div className="text-center py-8">
            <GraduationCap size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">
              {busqueda ? "No se encontraron estudiantes con esa búsqueda." : "No hay estudiantes registrados."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Encabezados de columnas - Solo visible en desktop */}
            <div className="hidden lg:block bg-sky-50 border border-sky-200 rounded-lg p-4">
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-1 flex justify-center">
                  <div className="w-5"></div>
                </div>
                <div className="col-span-3">
                  <p className="font-semibold text-sky-800 text-sm">NOMBRE</p>
                </div>
                <div className="col-span-2">
                  <p className="font-semibold text-sky-800 text-sm">CÓDIGO</p>
                </div>
                <div className="col-span-2">
                  <p className="font-semibold text-sky-800 text-sm">CURSO</p>
                </div>
                <div className="col-span-2">
                  <p className="font-semibold text-sky-800 text-sm">ESCUELA</p>
                </div>
                <div className="col-span-1 text-center">
                  <p className="font-semibold text-sky-800 text-sm">TIPO</p>
                </div>
                <div className="col-span-1 text-center">
                  <p className="font-semibold text-sky-800 text-sm">QR</p>
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
                    className="bg-white p-3 sm:p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {/* Vista Desktop - Grid */}
                    <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                      {/* Icono */}
                      <div className="col-span-1 flex justify-center">
                        {e.tipo === "alumno" ? (
                          <GraduationCap size={20} className="text-sky-700" />
                        ) : (
                          <Users size={20} className="text-gray-600" />
                        )}
                      </div>

                      {/* Nombre */}
                      <div className="col-span-3">
                        <p className="font-semibold text-sky-800 truncate">{e.nombre}</p>
                      </div>

                      {/* Código */}
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 truncate">{e.codigo}</p>
                      </div>

                      {/* Curso */}
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 truncate">{e.curso}</p>
                      </div>

                      {/* Escuela */}
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600 truncate">{e.escuela}</p>
                      </div>

                      {/* Tipo */}
                      <div className="col-span-1 flex justify-center">
                        {e.tipo === "externo" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                            <Users size={10} /> Ext
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded-full">
                            <GraduationCap size={10} /> USS
                          </span>
                        )}
                      </div>

                      {/* QR Desktop */}
                      <div className="col-span-1 flex justify-center">
                        {tieneQR ? (
                          <div className="text-center space-y-2">
                            <div className="relative">
                              <img
                                src={tieneQR}
                                alt={`QR de ${e.nombre}`}
                                className={`rounded-md border border-gray-200 shadow-sm transition-all duration-300 mx-auto ${
                                  estaExpandido ? 'w-24 h-24' : 'w-12 h-12'
                                }`}
                              />
                              {estaCargando && (
                                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-md">
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-600 border-t-transparent"></div>
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
                                <RefreshCw size={14} className={estaCargando ? 'animate-spin' : ''} />
                              </button>
                            </div>
                            
                            {estaExpandido && (
                              <button
                                onClick={() => descargarQR(e)}
                                className="w-full flex items-center justify-center gap-1 bg-sky-700 text-white px-2 py-1 rounded-md hover:bg-sky-800 transition-colors text-xs"
                                disabled={estaCargando}
                              >
                                <QrCode size={12} />
                                <Download size={12} />
                                Descargar
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-center space-y-2">
                            <div className="w-12 h-12 bg-gray-100 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center mx-auto">
                              {estaCargando ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-600 border-t-transparent"></div>
                              ) : (
                                <QrCode size={16} className="text-gray-400" />
                              )}
                            </div>
                            
                            <button
                              onClick={() => generarQR(e)}
                              className="px-2 py-1 bg-sky-600 text-white text-xs rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
                              disabled={estaCargando}
                            >
                              {estaCargando ? "Generando..." : "Generar QR"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vista Móvil/Tablet - Cards */}
                    <div className="lg:hidden">
                      {/* Header de la card */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {e.tipo === "alumno" ? (
                            <GraduationCap size={20} className="text-sky-700 flex-shrink-0" />
                          ) : (
                            <Users size={20} className="text-gray-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sky-800 text-sm sm:text-base truncate">{e.nombre}</h3>
                            <p className="text-xs sm:text-sm text-gray-600 font-mono">{e.codigo}</p>
                          </div>
                        </div>
                        
                        {/* Badge de tipo */}
                        <div className="flex-shrink-0">
                          {e.tipo === "externo" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                              <Users size={10} /> Ext
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded-full">
                              <GraduationCap size={10} /> USS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Información del estudiante */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs sm:text-sm">
                        <div>
                          <span className="text-gray-500">Curso:</span>
                          <p className="font-medium text-gray-700 truncate">{e.curso}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Escuela:</span>
                          <p className="font-medium text-gray-700 truncate">{e.escuela}</p>
                        </div>
                      </div>

                      {/* Sección QR */}
                      <div className="border-t border-gray-100 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">Código QR</span>
                          
                          {tieneQR ? (
                            <div className="flex items-center gap-2">
                              {/* Imagen QR compacta */}
                              <div className="relative">
                                <img
                                  src={tieneQR}
                                  alt={`QR de ${e.nombre}`}
                                  className={`rounded-md border border-gray-200 shadow-sm transition-all duration-300 ${
                                    estaExpandido ? 'w-16 h-16' : 'w-8 h-8'
                                  }`}
                                />
                                {estaCargando && (
                                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-md">
                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-sky-600 border-t-transparent"></div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Botones de control compactos */}
                              <div className="flex gap-1">
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
                                  <RefreshCw size={12} className={estaCargando ? 'animate-spin' : ''} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-100 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center">
                                {estaCargando ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-sky-600 border-t-transparent"></div>
                                ) : (
                                  <QrCode size={12} className="text-gray-400" />
                                )}
                              </div>
                              
                              <button
                                onClick={() => generarQR(e)}
                                className="px-2 py-1 bg-sky-600 text-white text-xs rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50"
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
                              className="mt-2 w-full flex items-center justify-center gap-1 bg-sky-700 text-white px-3 py-2 rounded-md hover:bg-sky-800 transition-colors text-xs"
                              disabled={estaCargando}
                            >
                              <QrCode size={12} />
                              <Download size={12} />
                              Descargar QR
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}