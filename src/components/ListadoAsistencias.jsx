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
import { themes } from "../App";

export default function ListadoAsistencias({ selectedTheme }) {
  const [asistencias, setAsistencias] = useState([]);
  const [asistenciasFiltradas, setAsistenciasFiltradas] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState("hoy");
  const [filtroSesion, setFiltroSesion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Obtener estilos del tema seleccionado
  const themeStyles = themes[selectedTheme];

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
          fillColor: [themeStyles.primary.replace('#', '0x').slice(0, 8), themeStyles.primary.replace('#', '0x').slice(2, 4), themeStyles.primary.replace('#', '0x').slice(4, 6), themeStyles.primary.replace('#', '0x').slice(6, 8)].map(c => parseInt(c, 16)),
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
    <div className="p-3 sm:p-4 md:p-6 rounded-xl shadow-md border space-y-4 sm:space-y-6" style={{ backgroundColor: themeStyles.background, borderColor: themeStyles.textSecondary }}>
      {/* Header con título y botones - Mejorado para móviles */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2" style={{ color: themeStyles.textPrimary }}>
            <ClipboardCheck size={20} style={{ color: themeStyles.primary }}/>
            Listado de Asistencias
          </h3>
          
          {/* Botones de exportación - Centrados en móvil */}
          <div className="flex justify-center sm:justify-end w-full sm:w-auto gap-2">
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white rounded-md text-sm hover:bg-opacity-80 disabled:opacity-50 transition-colors duration-200"
              style={{ backgroundColor: '#10B981'}}
              disabled={asistenciasFiltradas.length === 0}
            >
              <Download size={16} />
              <span className="hidden xs:inline">Excel</span>
            </button>
            <button
              onClick={exportarPDF}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-white rounded-md text-sm hover:bg-opacity-80 disabled:opacity-50 transition-colors duration-200"
              style={{ backgroundColor: '#EF4444' }}
              disabled={asistenciasFiltradas.length === 0}
            >
              <FileText size={16} />
              <span className="hidden xs:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* Estadísticas - Más estrechas para móvil y tablet */}
        <div className="w-full px-1 sm:px-0">
          <div className="grid grid-cols-3 gap-0.5 sm:gap-2 md:gap-3 p-1.5 sm:p-3 md:p-4 rounded-lg border" style={{ backgroundColor: themeStyles.primary + '11', borderColor: themeStyles.primary }}>
            <div className="text-center px-0.5 sm:px-1">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold" style={{ color: themeStyles.primary }}>{asistenciasFiltradas.length}</p>
              <p className="text-xs truncate" style={{ color: themeStyles.textSecondary }}>Total</p>
            </div>
            <div className="text-center px-0.5 sm:px-1">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-blue-600">{totalEntradas}</p>
              <p className="text-xs truncate" style={{ color: themeStyles.textSecondary }}>Entradas</p>
            </div>
            <div className="text-center px-0.5 sm:px-1">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-red-600">{totalSalidas}</p>
              <p className="text-xs truncate" style={{ color: themeStyles.textSecondary }}>Salidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros - Optimizados para móvil y tablet */}
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border" style={{ backgroundColor: themeStyles.primary + '05', borderColor: themeStyles.textSecondary }}>
        {/* Búsqueda */}
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium mb-2" style={{ color: themeStyles.textPrimary }}>
            <Search size={16} className="inline mr-1" style={{ color: themeStyles.primary }}/> Buscar
          </label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full border rounded-md p-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ 
                borderColor: themeStyles.textSecondary,
                backgroundColor: themeStyles.background,
                color: themeStyles.textPrimary,
                focusRingColor: themeStyles.primary
            }}
          />
        </div>

        {/* Filtro Fecha */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: themeStyles.textPrimary }}>
            <Calendar size={16} className="inline mr-1" style={{ color: themeStyles.primary }}/> Período
          </label>
          <select
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="w-full border rounded-md p-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ 
                borderColor: themeStyles.textSecondary,
                backgroundColor: themeStyles.background,
                color: themeStyles.textPrimary,
                focusRingColor: themeStyles.primary
            }}
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
          <label className="block text-sm font-medium mb-2" style={{ color: themeStyles.textPrimary }}>
            Sesión
          </label>
          <select
            value={filtroSesion}
            onChange={(e) => setFiltroSesion(e.target.value)}
            className="w-full border rounded-md p-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ 
                borderColor: themeStyles.textSecondary,
                backgroundColor: themeStyles.background,
                color: themeStyles.textPrimary,
                focusRingColor: themeStyles.primary
            }}
          >
            <option value="">Todas las sesiones</option>
            {sesionesUnicas.map(sesion => (
              <option key={sesion} value={sesion}>Sesión {sesion}</option>
            ))}
          </select>
        </div>

        {/* Selección de registros por página */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: themeStyles.textPrimary }}>
            Registros por página
          </label>
          <select
            value={recordsPerPage}
            onChange={(e) => {
              setRecordsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="w-full border rounded-md p-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ 
                borderColor: themeStyles.textSecondary,
                backgroundColor: themeStyles.background,
                color: themeStyles.textPrimary,
                focusRingColor: themeStyles.primary
            }}
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
        <div className="hidden lg:block border rounded-md shadow-sm" style={{ backgroundColor: themeStyles.primary + '1A', borderColor: themeStyles.primary }}>
          <div className="grid grid-cols-6 gap-4 items-center p-4">
            <div className="col-span-2">
              <p className="text-sm font-medium" style={{ color: themeStyles.primary }}>Nombre</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium" style={{ color: themeStyles.primary }}>Código</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium" style={{ color: themeStyles.primary }}>Tipo</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium" style={{ color: themeStyles.primary }}>Sesión</p>
            </div>
            <div className="col-span-1">
              <p className="text-sm font-medium" style={{ color: themeStyles.primary }}>Acción</p>
            </div>
          </div>
        </div>

        {/* Lista de asistencias */}
        <ul className="space-y-3 sm:space-y-2">
          {paginatedAsistencias.map((a) => (
            <li
              key={a.id}
              className="p-4 sm:p-5 rounded-lg border shadow-sm hover:shadow-md transition-all duration-200"
              style={{ backgroundColor: '#FFFFFF', borderColor: themeStyles.textSecondary }}
            >
              {/* Vista Desktop - Grid */}
              <div className="hidden lg:grid grid-cols-6 gap-4 items-center">
                {/* Nombre - 2 columnas */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    {a.tipo === "externo" ? (
                      <Users size={16} className="flex-shrink-0" style={{ color: themeStyles.textSecondary }} />
                    ) : (
                      <GraduationCap size={16} className="flex-shrink-0" style={{ color: themeStyles.primary }}/>
                    )}
                    <span className="font-medium truncate" style={{ color: themeStyles.textPrimary }}>{a.nombre}</span>
                  </div>
                </div>

                {/* Código - 1 columna */}
                <div className="col-span-1">
                  <span className="text-sm font-mono" style={{ color: themeStyles.textSecondary }}>{a.codigo}</span>
                </div>

                {/* Tipo - 1 columna */}
                <div className="col-span-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium`} style={{ 
                      backgroundColor: a.tipo === "externo" ? '#E5E7EB' : themeStyles.primary + '1A',
                      color: a.tipo === "externo" ? '#4B5563' : themeStyles.primary
                  }}>
                    {a.tipo === "externo" ? "Externo" : "USS"}
                  </span>
                </div>

                {/* Sesión - 1 columna */}
                <div className="col-span-1 text-center">
                  <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: themeStyles.secondary + '33', color: themeStyles.secondary }}>
                    {a.sesion}
                  </span>
                </div>

                {/* Acción - 1 columna */}
                <div className="col-span-1">
                  <div className="flex items-center gap-1">
                    {a.accion === "entrada" ? (
                      <>
                        <LogIn size={14} className="flex-shrink-0" style={{ color: '#2563EB' }} />
                        <span className="font-medium text-sm" style={{ color: '#2563EB' }}>Entrada</span>
                      </>
                    ) : (
                      <>
                        <LogOut size={14} className="flex-shrink-0" style={{ color: '#DC2626' }} />
                        <span className="font-medium text-sm" style={{ color: '#DC2626' }}>Salida</span>
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
                      <Users size={20} className="flex-shrink-0" style={{ color: themeStyles.textSecondary }}/>
                    ) : (
                      <GraduationCap size={20} className="flex-shrink-0" style={{ color: themeStyles.primary }}/>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base sm:text-lg truncate" style={{ color: themeStyles.textPrimary }}>{a.nombre}</h3>
                      <p className="text-sm font-mono" style={{ color: themeStyles.textSecondary }}>{a.codigo}</p>
                    </div>
                  </div>
                  
                  {/* Badge de tipo */}
                  <div className="flex-shrink-0">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium`} style={{ 
                        backgroundColor: a.tipo === "externo" ? '#E5E7EB' : themeStyles.primary + '1A',
                        color: a.tipo === "externo" ? '#4B5563' : themeStyles.primary
                    }}>
                      {a.tipo === "externo" ? "Externo" : "USS"}
                    </span>
                  </div>
                </div>

                {/* Información de la asistencia */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium" style={{ color: themeStyles.textSecondary }}>Sesión</span>
                    <div>
                      <span className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: themeStyles.secondary + '33', color: themeStyles.secondary }}>
                        {a.sesion}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium" style={{ color: themeStyles.textSecondary }}>Acción</span>
                    <div className="flex items-center gap-2">
                      {a.accion === "entrada" ? (
                        <>
                          <LogIn size={14} className="flex-shrink-0" style={{ color: '#2563EB' }}/>
                          <span className="font-medium text-sm" style={{ color: '#2563EB' }}>Entrada</span>
                        </>
                      ) : (
                        <>
                          <LogOut size={14} className="flex-shrink-0" style={{ color: '#DC2626' }}/>
                          <span className="font-medium text-sm" style={{ color: '#DC2626' }}>Salida</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fecha y hora */}
                <div className="border-t pt-4" style={{ borderColor: themeStyles.textSecondary + '22' }}>
                  <div className="text-center space-y-1">
                    <div className="font-semibold text-base" style={{ color: themeStyles.textPrimary }}>{formatDate(a.timestamp)}</div>
                    <div className="text-sm" style={{ color: themeStyles.textSecondary }}>{formatTime(a.timestamp)}</div>
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
          <div className="text-xs sm:text-sm text-center sm:text-left px-1" style={{ color: themeStyles.textSecondary }}>
            Mostrando {startIndex + 1} - {Math.min(endIndex, asistenciasFiltradas.length)} de {asistenciasFiltradas.length} registros
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 sm:px-2.5 py-1.5 rounded-md disabled:opacity-50 text-xs sm:text-sm transition-colors duration-200"
              style={{ backgroundColor: themeStyles.secondary + '22', color: themeStyles.secondary, hover: themeStyles.secondary + '33' }}
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
                  className={`px-2 sm:px-2.5 py-1.5 rounded-md text-xs sm:text-sm transition-colors duration-200 ${
                    currentPage === page ? "text-white" : ""
                  }`}
                  style={{
                    backgroundColor: currentPage === page ? themeStyles.primary : themeStyles.secondary + '22',
                    color: currentPage === page ? '#FFFFFF' : themeStyles.secondary,
                    hover: themeStyles.secondary + '33'
                  }}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 sm:px-2.5 py-1.5 rounded-md disabled:opacity-50 text-xs sm:text-sm transition-colors duration-200"
              style={{ backgroundColor: themeStyles.secondary + '22', color: themeStyles.secondary, hover: themeStyles.secondary + '33' }}
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay datos */}
      {asistenciasFiltradas.length === 0 && (
        <div className="text-center py-8">
          <ClipboardCheck size={48} className="mx-auto mb-4" style={{ color: themeStyles.textSecondary + '66' }}/>
          <p style={{ color: themeStyles.textSecondary }}>No hay asistencias para mostrar.</p>
          {asistencias.length > 0 && (
            <p className="text-sm mt-2" style={{ color: themeStyles.textSecondary + 'CC' }}>
              Intenta cambiar los filtros para ver más resultados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}