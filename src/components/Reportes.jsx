import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";
import { TrendingUp, Calendar, Users, GraduationCap, Clock, BarChart3 } from "lucide-react";

export default function Reportes() {
  const [asistencias, setAsistencias] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState("semana");
  const [filtroSesion, setFiltroSesion] = useState("");
  const [tipoGrafico, setTipoGrafico] = useState("barras");

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
    return d.toLocaleDateString("es-ES");
  };

  // Aplicar filtros de fecha
  const aplicarFiltroFecha = (asistencias) => {
    const hoy = new Date();
    let filtradas = [...asistencias];

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
      case "trimestre":
        const inicioTrimestre = new Date(hoy);
        inicioTrimestre.setMonth(hoy.getMonth() - 3);
        filtradas = filtradas.filter(a => {
          const ta = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
          return ta >= inicioTrimestre;
        });
        break;
    }

    // Filtro por sesión
    if (filtroSesion) {
      filtradas = filtradas.filter(a => a.sesion === filtroSesion);
    }

    return filtradas;
  };

  const asistenciasFiltradas = aplicarFiltroFecha(asistencias);

  // Datos para gráfico de barras por día
  const datosAsistenciasPorDia = asistenciasFiltradas.reduce((acc, a) => {
    const fecha = formatDate(a.timestamp);
    if (!acc[fecha]) {
      acc[fecha] = { fecha, entradas: 0, salidas: 0, total: 0 };
    }
    if (a.accion === "entrada") {
      acc[fecha].entradas += 1;
    } else if (a.accion === "salida") {
      acc[fecha].salidas += 1;
    }
    acc[fecha].total += 1;
    return acc;
  }, {});

  const datosAsistenciasPorDiaArray = Object.values(datosAsistenciasPorDia)
    .sort((a, b) => new Date(a.fecha.split('/').reverse().join('-')) - new Date(b.fecha.split('/').reverse().join('-')));

  // Datos para gráfico de pie - Tipos de usuarios
  const datosTipoUsuario = asistenciasFiltradas.reduce((acc, a) => {
    const tipo = a.tipo === 'externo' ? 'Externos' : 'Estudiantes USS';
    if (!acc[tipo]) {
      acc[tipo] = 0;
    }
    acc[tipo] += 1;
    return acc;
  }, {});

  const datosTipoUsuarioArray = Object.entries(datosTipoUsuario).map(([tipo, cantidad]) => ({
    tipo,
    cantidad
  }));

  // Datos para gráfico de barras por sesión
  const datosAsistenciasPorSesion = asistenciasFiltradas.reduce((acc, a) => {
    const sesion = `Sesión ${a.sesion}`;
    if (!acc[sesion]) {
      acc[sesion] = { sesion, entradas: 0, salidas: 0, total: 0 };
    }
    if (a.accion === "entrada") {
      acc[sesion].entradas += 1;
    } else if (a.accion === "salida") {
      acc[sesion].salidas += 1;
    }
    acc[sesion].total += 1;
    return acc;
  }, {});

  const datosAsistenciasPorSesionArray = Object.values(datosAsistenciasPorSesion)
    .sort((a, b) => parseInt(a.sesion.split(' ')[1]) - parseInt(b.sesion.split(' ')[1]));

  // Datos para gráfico de línea - Tendencia por hora del día
  const datosAsistenciasPorHora = asistenciasFiltradas.reduce((acc, a) => {
    const fecha = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
    const hora = fecha.getHours();
    if (!acc[hora]) {
      acc[hora] = { hora: `${hora}:00`, cantidad: 0 };
    }
    acc[hora].cantidad += 1;
    return acc;
  }, {});

  const datosAsistenciasPorHoraArray = Array.from({ length: 24 }, (_, i) => 
    datosAsistenciasPorHora[i] || { hora: `${i}:00`, cantidad: 0 }
  ).filter(item => item.cantidad > 0);

  // Estadísticas generales
  const totalRegistros = asistenciasFiltradas.length;
  const totalEntradas = asistenciasFiltradas.filter(a => a.accion === 'entrada').length;
  const totalSalidas = asistenciasFiltradas.filter(a => a.accion === 'salida').length;
  const personasUnicas = new Set(asistenciasFiltradas.map(a => a.codigo)).size;
  const sesionesActivas = new Set(asistenciasFiltradas.map(a => a.sesion)).size;

  // Obtener sesiones únicas para filtro
  const sesionesUnicas = [...new Set(asistencias.map(a => a.sesion))].sort((a, b) => parseInt(a) - parseInt(b));

  // Colores para gráficos
  const colores = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-sky-800 flex items-center gap-2">
          <TrendingUp size={20} />
          Reportes y Estadísticas
        </h3>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar size={16} className="inline mr-1" /> Período
          </label>
          <select
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="hoy">Hoy</option>
            <option value="ayer">Ayer</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="trimestre">Último trimestre</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sesión
          </label>
          <select
            value={filtroSesion}
            onChange={(e) => setFiltroSesion(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="">Todas las sesiones</option>
            {sesionesUnicas.map(sesion => (
              <option key={sesion} value={sesion}>Sesión {sesion}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <BarChart3 size={16} className="inline mr-1" /> Tipo de Gráfico
          </label>
          <select
            value={tipoGrafico}
            onChange={(e) => setTipoGrafico(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="barras">Barras por Día</option>
            <option value="sesiones">Barras por Sesión</option>
            <option value="tipos">Distribución por Tipo</option>
            <option value="horas">Tendencia por Horas</option>
          </select>
        </div>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
        <div className="text-center">
          <p className="text-2xl font-bold text-sky-700">{totalRegistros}</p>
          <p className="text-xs text-gray-600">Total Registros</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{totalEntradas}</p>
          <p className="text-xs text-gray-600">Entradas</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">{totalSalidas}</p>
          <p className="text-xs text-gray-600">Salidas</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{personasUnicas}</p>
          <p className="text-xs text-gray-600">Personas Únicas</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600">{sesionesActivas}</p>
          <p className="text-xs text-gray-600">Sesiones Activas</p>
        </div>
      </div>

      {/* Gráficos según selección */}
      <div className="h-96">
        {tipoGrafico === "barras" && datosAsistenciasPorDiaArray.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-800 mb-4">Asistencias por Día</h4>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={datosAsistenciasPorDiaArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="entradas" fill="#3b82f6" name="Entradas" />
                <Bar dataKey="salidas" fill="#10b981" name="Salidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tipoGrafico === "sesiones" && datosAsistenciasPorSesionArray.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-800 mb-4">Asistencias por Sesión</h4>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={datosAsistenciasPorSesionArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sesion" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="entradas" fill="#3b82f6" name="Entradas" />
                <Bar dataKey="salidas" fill="#10b981" name="Salidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tipoGrafico === "tipos" && datosTipoUsuarioArray.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-800 mb-4">Distribución por Tipo de Usuario</h4>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={datosTipoUsuarioArray}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ tipo, cantidad, percent }) => `${tipo}: ${cantidad} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="cantidad"
                >
                  {datosTipoUsuarioArray.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colores[index % colores.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {tipoGrafico === "horas" && datosAsistenciasPorHoraArray.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-800 mb-4">Distribución por Horas del Día</h4>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={datosAsistenciasPorHoraArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="cantidad" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.3}
                  name="Registros"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Mensaje cuando no hay datos */}
        {((tipoGrafico === "barras" && datosAsistenciasPorDiaArray.length === 0) ||
          (tipoGrafico === "sesiones" && datosAsistenciasPorSesionArray.length === 0) ||
          (tipoGrafico === "tipos" && datosTipoUsuarioArray.length === 0) ||
          (tipoGrafico === "horas" && datosAsistenciasPorHoraArray.length === 0)) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BarChart3 size={64} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No hay datos suficientes para mostrar este gráfico</p>
              <p className="text-sm text-gray-500 mt-2">Prueba ajustando los filtros o seleccionando un período diferente</p>
            </div>
          </div>
        )}
      </div>

      {/* Resumen de insights */}
      {asistenciasFiltradas.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Resumen del Período</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              • Promedio de registros por día: {Math.round(totalRegistros / Math.max(datosAsistenciasPorDiaArray.length, 1))}
            </div>
            <div>
              • Ratio entradas/salidas: {totalSalidas > 0 ? (totalEntradas / totalSalidas).toFixed(2) : 'N/A'}
            </div>
            <div>
              • Personas más activas: {personasUnicas} usuarios únicos
            </div>
            <div>
              • Sesiones con actividad: {sesionesActivas} de {sesionesUnicas.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}