import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { ClipboardCheck, Calendar, Search, Download, FileText, Users, GraduationCap, LogIn, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ListadoAsistencias() {
  const [asistencias, setAsistencias] = useState([]);
  const [asistenciasFiltradas, setAsistenciasFiltradas] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState("hoy");
  const [filtroSesion, setFiltroSesion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Escuchar cambios en la base de datos
  useEffect(() => {
    const unsubAsistencias = onSnapshot(collection(db, "asistencias"), (snapshot) => {
      const registros = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAsistencias(registros);
    });

    return () => {
      unsubAsistencias();
    };
  }, []);

  const formatDate = (v) => {
    if (!v) return "";
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return d.toLocaleDateString("es-ES", {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (v) => {
    if (!v) return "";
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return d.toLocaleTimeString("es-ES", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDateTime = (v) => {
    if (!v) return "";
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    return d.toLocaleString("es-ES");
  };

  // Aplicar filtros simples
  useEffect(() => {
    let filtradas = [...asistencias].sort((a, b) => {
      const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
      const tb = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
      return tb - ta; // Más recientes primero
    });

    // Filtro por fecha
    const hoy = new Date();
    switch (filtroFecha) {
      case "hoy":
        filtradas = filtradas.filter(a => {
          const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
          return ta.toDateString() === hoy.toDateString();
        });
        break;
      case "ayer":
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        filtradas = filtradas.filter(a => {
          const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
          return ta.toDateString() === ayer.toDateString();
        });
        break;
      case "semana":
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - 7);
        filtradas = filtradas.filter(a => {
          const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
          return ta >= inicioSemana;
        });
        break;
      case "mes":
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        filtradas = filtradas.filter(a => {
          const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
          return ta >= inicioMes;
        });
        break;
    }

    // Filtro por sesión
    if (filtroSesion) {
      filtradas = filtradas.filter(a => a.sesion === filtroSesion);
    }

    // Filtro por búsqueda
    if (busqueda) {
      filtradas = filtradas.filter(a => 
        a.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.codigo?.toLowerCase().includes(busqueda.toLowerCase())
      );
    }

    setAsistenciasFiltradas(filtradas);
    setCurrentPage(1);
  }, [filtroFecha, filtroSesion, busqueda, asistencias]);

  // Obtener sesiones únicas
  const sesionesUnicas = [...new Set(asistencias.map(a => a.sesion))].sort((a, b) => parseInt(a) - parseInt(b));

  // Pagination logic
  const totalPages = Math.ceil(asistenciasFiltradas.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedAsistencias = asistenciasFiltradas.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Preparar datos para exportación
  const prepararDatos = () => {
    return asistenciasFiltradas.map(a => ({
      'Nombre': a.nombre || '',
      'Código': a.codigo || '',
      'Tipo': a.tipo === 'externo' ? 'Externo' : 'Alumno USS',
      'Sesión': `Sesión ${a.sesion}`,
      'Acción': a.accion === 'entrada' ? 'Entrada' : 'Salida',
      'Fecha': formatDate(a.timestamp),
      'Hora': formatTime(a.timestamp),
      'Curso': a.curso || '-',
      'Escuela': a.escuela || '-'
    }));
  };

  // Exportar a Excel
  const exportarExcel = () => {
    const datos = prepararDatos();
    
    if (datos.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datos);
      
      const columnWidths = [
        { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, 
        { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 25 }
      ];
      ws['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');
      
      const fechaHoy = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Reporte_Asistencias_${fechaHoy}.xlsx`;
      
      XLSX.writeFile(wb, nombreArchivo);
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      alert('Error al exportar a Excel. Verifica que las librerías estén instaladas.');
    }
  };

  // Exportar a PDF
  const exportarPDF = () => {
    const datos = prepararDatos();
    
    if (datos.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      const doc = new jsPDF('portrait'); 
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE DE ASISTENCIAS', doc.internal.pageSize.width / 2, 20, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const fechaHoy = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(`Fecha: ${fechaHoy}`, 20, 32);
      doc.text(`Registros: ${datos.length}`, 20, 38);
      
      let filtrosTexto = '';
      if (filtroFecha !== 'todos') filtrosTexto += `${filtroFecha} `;
      if (filtroSesion) filtrosTexto += `S${filtroSesion} `;
      if (busqueda) filtrosTexto += `"${busqueda}"`;
      
      if (filtrosTexto) {
        doc.text(`Filtros: ${filtrosTexto}`, 20, 44);
      }

      const totalEntradas = datos.filter(d => d.Acción === 'Entrada').length;
      const totalSalidas = datos.filter(d => d.Acción === 'Salida').length;
      
      doc.text(`Entradas: ${totalEntradas} | Salidas: ${totalSalidas}`, 20, 50);

      const columnas = [
        { header: 'Nombre', dataKey: 'Nombre' },
        { header: 'Código', dataKey: 'Código' },
        { header: 'Tipo', dataKey: 'Tipo' },
        { header: 'S', dataKey: 'Sesión' },
        { header: 'Acción', dataKey: 'Acción' },
        { header: 'Fecha/Hora', dataKey: 'FechaHora' }
      ];

      const datosCompactos = datos.map(d => ({
        ...d,
        FechaHora: `${d.Fecha} ${d.Hora}`,
        Sesión: d.Sesión.replace('Sesión ', '')
      }));

      autoTable(doc, {
        columns: columnas,
        body: datosCompactos,
        startY: 58,
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [245, 248, 250]
        },
        tableWidth: 'auto',
        margin: { left: 10, right: 10 },
        theme: 'striped'
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      const fechaArchivo = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Reporte_Asistencias_${fechaArchivo}.pdf`;
      
      doc.save(nombreArchivo);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al exportar a PDF. Verifica que las librerías estén instaladas.');
    }
  };

  // Estadísticas básicas
  const totalEntradas = asistenciasFiltradas.filter(a => a.accion === "entrada").length;
  const totalSalidas = asistenciasFiltradas.filter(a => a.accion === "salida").length;

  return (
    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-xl shadow-md border border-gray-200 space-y-4 sm:space-y-6">
      {/* Header con título y botones - Mejorado para móviles */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-lg sm:text-xl font-semibold text-sky-800 flex items-center gap-2">
            <ClipboardCheck size={20} />
            Listado de Asistencias
          </h3>
          
          {/* Botones de exportación - Centrados en móvil */}
          <div className="flex justify-center sm:justify-end w-full sm:w-auto gap-2">
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
              disabled={asistenciasFiltradas.length === 0}
            >
              <Download size={16} />
              <span className="hidden xs:inline">Excel</span>
            </button>
            <button
              onClick={exportarPDF}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
              disabled={asistenciasFiltradas.length === 0}
            >
              <FileText size={16} />
              <span className="hidden xs:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* Estadísticas - Más estrechas para móvil y tablet */}
        <div className="w-full px-1 sm:px-0">
          <div className="grid grid-cols-3 gap-0.5 sm:gap-2 md:gap-3 p-1.5 sm:p-3 md:p-4 bg-sky-50 rounded-lg border border-sky-200">
            <div className="text-center px-0.5 sm:px-1">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-sky-700">{asistenciasFiltradas.length}</p>
              <p className="text-xs text-gray-600 truncate">Total</p>
            </div>
            <div className="text-center px-0.5 sm:px-1">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-blue-600">{totalEntradas}</p>
              <p className="text-xs text-gray-600 truncate">Entradas</p>
            </div>
            <div className="text-center px-0.5 sm:px-1">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-red-600">{totalSalidas}</p>
              <p className="text-xs text-gray-600 truncate">Salidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros - Optimizados para móvil y tablet */}
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* Búsqueda */}
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Search size={16} className="inline mr-1" /> Buscar
          </label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filtro Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar size={16} className="inline mr-1" /> Período
          </label>
          <select
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="hoy">Hoy</option>
            <option value="ayer">Ayer</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        {/* Filtro Sesión */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sesión
          </label>
          <select
            value={filtroSesion}
            onChange={(e) => setFiltroSesion(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todas las sesiones</option>
            {sesionesUnicas.map(sesion => (
              <option key={sesion} value={sesion}>Sesión {sesion}</option>
            ))}
          </select>
        </div>

        {/* Selección de registros por página */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Registros por página
          </label>
          <select
            value={recordsPerPage}
            onChange={(e) => {
              setRecordsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Lista de asistencias - Responsive */}
      <div className="space-y-3 sm:space-y-2">
        {/* Encabezados de columnas - Solo visible en desktop */}
        <div className="hidden lg:block bg-gray-100 text-sky-800 text-left border border-gray-200 rounded-md shadow-sm">
          <div className="grid grid-cols-6 gap-4 items-center p-4">
            <div className="col-span-2">
              <p className="text-sm font-medium">Nombre</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium">Código</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium">Tipo</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium">Sesión</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium">Acción</p>
            </div>
          </div>
        </div>

        {/* Lista de asistencias */}
        <ul className="space-y-3 sm:space-y-2">
          {paginatedAsistencias.map((a) => (
            <li
              key={a.id}
              className="bg-white p-4 sm:p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Vista Desktop - Grid */}
              <div className="hidden lg:grid grid-cols-6 gap-4 items-center">
                {/* Nombre - 2 columnas */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    {a.tipo === "externo" ? (
                      <Users size={16} className="text-gray-600 flex-shrink-0" />
                    ) : (
                      <GraduationCap size={16} className="text-sky-700 flex-shrink-0" />
                    )}
                    <span className="font-medium text-gray-700 truncate">{a.nombre}</span>
                  </div>
                </div>

                {/* Código - 1 columna */}
                <div className="col-span-1">
                  <span className="text-sm text-gray-600 font-mono">{a.codigo}</span>
                </div>

                {/* Tipo - 1 columna */}
                <div className="col-span-1">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    a.tipo === "externo" 
                      ? "bg-gray-100 text-gray-800" 
                      : "bg-sky-100 text-sky-800"
                  }`}>
                    {a.tipo === "externo" ? "Externo" : "USS"}
                  </span>
                </div>

                {/* Sesión - 1 columna */}
                <div className="col-span-1 text-center">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                    {a.sesion}
                  </span>
                </div>

                {/* Acción - 1 columna */}
                <div className="col-span-1">
                  <div className="flex items-center gap-1">
                    {a.accion === "entrada" ? (
                      <>
                        <LogIn size={14} className="text-blue-600 flex-shrink-0" />
                        <span className="text-blue-600 font-medium text-sm">Entrada</span>
                      </>
                    ) : (
                      <>
                        <LogOut size={14} className="text-red-600 flex-shrink-0" />
                        <span className="text-red-600 font-medium text-sm">Salida</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Vista Móvil/Tablet - Cards */}
              <div className="lg:hidden">
                {/* Header de la card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {a.tipo === "externo" ? (
                      <Users size={20} className="text-gray-600 flex-shrink-0" />
                    ) : (
                      <GraduationCap size={20} className="text-sky-700 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sky-800 text-base sm:text-lg truncate">{a.nombre}</h3>
                      <p className="text-sm text-gray-600 font-mono">{a.codigo}</p>
                    </div>
                  </div>
                  
                  {/* Badge de tipo */}
                  <div className="flex-shrink-0">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      a.tipo === "externo" 
                        ? "bg-gray-100 text-gray-800" 
                        : "bg-sky-100 text-sky-800"
                    }`}>
                      {a.tipo === "externo" ? "Externo" : "USS"}
                    </span>
                  </div>
                </div>

                {/* Información de la asistencia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Sesión</span>
                    <div>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md text-sm font-medium">
                        {a.sesion}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-500">Acción</span>
                    <div className="flex items-center gap-2">
                      {a.accion === "entrada" ? (
                        <>
                          <LogIn size={14} className="text-blue-600 flex-shrink-0" />
                          <span className="text-blue-600 font-medium text-sm">Entrada</span>
                        </>
                      ) : (
                        <>
                          <LogOut size={14} className="text-red-600 flex-shrink-0" />
                          <span className="text-red-600 font-medium text-sm">Salida</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fecha y hora */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-center space-y-1">
                    <div className="font-semibold text-base text-gray-800">{formatDate(a.timestamp)}</div>
                    <div className="text-gray-500 text-sm">{formatTime(a.timestamp)}</div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Paginación - Optimizada para móvil y tablet */}
      {asistenciasFiltradas.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 mt-3 sm:mt-4">
          <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left px-1">
            Mostrando {startIndex + 1} - {Math.min(endIndex, asistenciasFiltradas.length)} de {asistenciasFiltradas.length} registros
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 sm:px-2.5 py-1.5 bg-blue-100 text-blue-800 rounded-md disabled:opacity-50 hover:bg-blue-200 text-xs sm:text-sm"
            >
              <ChevronLeft size={12} />
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
              let page;
              if (totalPages <= 3) {
                page = i + 1;
              } else {
                if (currentPage <= 2) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  page = totalPages - 2 + i;
                } else {
                  page = currentPage - 1 + i;
                }
              }
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-2 sm:px-2.5 py-1.5 rounded-md text-xs sm:text-sm ${
                    currentPage === page ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 sm:px-2.5 py-1.5 bg-blue-100 text-blue-800 rounded-md disabled:opacity-50 hover:bg-blue-200 text-xs sm:text-sm"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay datos */}
      {asistenciasFiltradas.length === 0 && (
        <div className="text-center py-8">
          <ClipboardCheck size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No hay asistencias para mostrar.</p>
          {asistencias.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Intenta cambiar los filtros para ver más resultados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}