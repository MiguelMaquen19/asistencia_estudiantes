import { useState } from "react";
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  UserPlus,
  X,
  QrCode,
  Download,
  GraduationCap,
  Users,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

export default function FormularioRegistro({ onClose, userRole = null, isLoggedIn = false, selectedTheme, themes }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [facultad, setFacultad] = useState("");
  const [escuela, setEscuela] = useState("");
  const [curso, setCurso] = useState("");
  const [tipo, setTipo] = useState("alumno");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  
  // Estados para carga masiva
  const [archivo, setArchivo] = useState(null);
  const [modoMasivo, setModoMasivo] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [resultados, setResultados] = useState([]);
  const [procesandoMasivo, setProcesandoMasivo] = useState(false);

  // Obtener estilos del tema seleccionado
  const themeStyles = themes[selectedTheme];

  // Verificar si es docente logueado
  const esDocenteLogueado = isLoggedIn && (userRole === 'docente' || userRole === 'admin');

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
  const verificarDuplicados = async (codigo, nombre) => {
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
        return {
          duplicado: true,
          tipo: 'codigo',
          mensaje: `Ya existe un estudiante con el código: ${codigo}`
        };
      }

      // Buscar por nombre (normalizado para evitar duplicados por mayúsculas/acentos)
      const queryTodos = query(collection(db, "estudiantes"));
      const todosLosEstudiantes = await getDocs(queryTodos);
      
      for (const doc of todosLosEstudiantes.docs) {
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
      return { duplicado: false }; // En caso de error, permitir el registro
    }
  };

  const registrar = async (e) => {
    e.preventDefault();
    setMensaje("");

    if (!codigo || !nombre || !facultad || !escuela || !curso || !tipo) {
      setMensaje("⚠️ Completa todos los campos");
      return;
    }

    try {
      setCargando(true);

      // Verificar duplicados antes de registrar
      const verificacion = await verificarDuplicados(codigo, nombre);
      if (verificacion.duplicado) {
        setMensaje(`❌ ${verificacion.mensaje}`);
        setCargando(false);
        return;
      }

      // Normalizar código antes de guardar
      const codigoNormalizado = codigo.trim().toUpperCase();

      // Crear el documento del estudiante
      const docRef = await addDoc(collection(db, "estudiantes"), {
        codigo: codigoNormalizado,
        nombre: nombre.trim(),
        facultad: facultad.trim(),
        escuela: escuela.trim(),
        curso: curso.trim(),
        tipo,
        fechaCreacion: new Date(),
      });

      // Generar el QR con el código del estudiante
      const dataUrl = await QRCode.toDataURL(codigoNormalizado, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
        color: { dark: themeStyles.textPrimary, light: "#ffffff" },
      });

      // Actualizar el documento con la imagen QR en base64
      await updateDoc(doc(db, "estudiantes", docRef.id), {
        qrImage: dataUrl,
        qrGenerado: true,
        fechaQR: new Date()
      });

      const payload = {
        uid: docRef.id,
        codigo: codigoNormalizado,
        nombre: nombre.trim(),
        facultad: facultad.trim(),
        escuela: escuela.trim(),
        curso: curso.trim(),
        tipo,
        v: 1,
      };

      setQrPayload(payload);
      setQrDataUrl(dataUrl);
      setMensaje("✅ Estudiante registrado y QR guardado. Código generado abajo.");
      
      // Limpiar formulario
      setCodigo("");
      setNombre("");
      setFacultad("");
      setEscuela("");
      setCurso("");
      setTipo("alumno");
    } catch (error) {
      console.error("Error al registrar:", error);
      setMensaje("❌ No se pudo registrar el estudiante");
    } finally {
      setCargando(false);
    }
  };

  const manejarArchivoExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      setMensaje("❌ Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV");
      return;
    }

    setArchivo(file);
    setMensaje("📁 Archivo seleccionado: " + file.name);
  };

  const procesarArchivoExcel = async () => {
    if (!archivo) {
      setMensaje("⚠️ Selecciona un archivo primero");
      return;
    }

    try {
      setProcesandoMasivo(true);
      setResultados([]);
      setMensaje("📊 Procesando archivo Excel...");

      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Verificar que hay datos
          if (jsonData.length < 2) {
            setMensaje("❌ El archivo debe tener al menos una fila de datos además del encabezado");
            setProcesandoMasivo(false);
            return;
          }

          // Obtener encabezados (primera fila)
          const headers = jsonData[0].map(h => h?.toString().toLowerCase().trim());
          const estudiantes = [];

          // Mapear columnas esperadas
          const columnMap = {
            nombre: headers.findIndex(h => h.includes('nombre')),
            codigo: headers.findIndex(h => h.includes('codigo')),
            curso: headers.findIndex(h => h.includes('curso')),
            escuela: headers.findIndex(h => h.includes('escuela')),
            tipo: headers.findIndex(h => h.includes('tipo')),
            facultad: headers.findIndex(h => h.includes('facultad'))
          };

          // Verificar que se encontraron las columnas necesarias
          const columnasRequeridas = ['nombre', 'codigo', 'curso', 'escuela'];
          const columnasFaltantes = columnasRequeridas.filter(col => columnMap[col] === -1);
          
          if (columnasFaltantes.length > 0) {
            setMensaje(`❌ Faltan columnas requeridas: ${columnasFaltantes.join(', ')}`);
            setProcesandoMasivo(false);
            return;
          }

          // Procesar datos (saltar la fila de encabezados)
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const estudiante = {
              nombre: row[columnMap.nombre]?.toString().trim() || '',
              codigo: row[columnMap.codigo]?.toString().trim() || '',
              curso: row[columnMap.curso]?.toString().trim() || '',
              escuela: row[columnMap.escuela]?.toString().trim() || '',
              facultad: row[columnMap.facultad]?.toString().trim() || 'No especificada',
              tipo: row[columnMap.tipo]?.toString().toLowerCase().trim() || 'alumno'
            };

            // Validar datos requeridos
            if (estudiante.nombre && estudiante.codigo && estudiante.curso && estudiante.escuela) {
              // Normalizar tipo
              estudiante.tipo = estudiante.tipo.includes('extern') ? 'externo' : 'alumno';
              estudiantes.push({ ...estudiante, fila: i + 1 });
            }
          }

          if (estudiantes.length === 0) {
            setMensaje("❌ No se encontraron estudiantes válidos en el archivo");
            setProcesandoMasivo(false);
            return;
          }

          setProgreso({ actual: 0, total: estudiantes.length });
          setMensaje(`📝 Procesando ${estudiantes.length} estudiantes...`);

          const resultadosProceso = [];

          // Procesar cada estudiante
          for (let i = 0; i < estudiantes.length; i++) {
            const estudiante = estudiantes[i];
            setProgreso({ actual: i + 1, total: estudiantes.length });

            try {
              // Verificar duplicados antes de registrar
              const verificacion = await verificarDuplicados(estudiante.codigo, estudiante.nombre);
              if (verificacion.duplicado) {
                resultadosProceso.push({
                  fila: estudiante.fila,
                  nombre: estudiante.nombre,
                  codigo: estudiante.codigo,
                  status: 'error',
                  error: `Duplicado: ${verificacion.tipo === 'codigo' ? 'código ya existe' : 'nombre ya existe'}`
                });
                continue; // Saltar a la siguiente iteración
              }

              // Normalizar código antes de guardar
              const codigoNormalizado = estudiante.codigo.trim().toUpperCase();
              const estudianteNormalizado = {
                ...estudiante,
                codigo: codigoNormalizado,
                nombre: estudiante.nombre.trim(),
                facultad: estudiante.facultad.trim(),
                escuela: estudiante.escuela.trim(),
                curso: estudiante.curso.trim()
              };

              // Crear documento del estudiante
              const docRef = await addDoc(collection(db, "estudiantes"), {
                ...estudianteNormalizado,
                fechaCreacion: new Date(),
                origenCarga: 'excel'
              });

              // Generar QR
              const dataUrl = await QRCode.toDataURL(codigoNormalizado, {
                errorCorrectionLevel: "H",
                margin: 2,
                width: 300,
                color: { dark: themeStyles.textPrimary, light: "#ffffff" },
              });

              // Actualizar con QR
              await updateDoc(doc(db, "estudiantes", docRef.id), {
                qrImage: dataUrl,
                qrGenerado: true,
                fechaQR: new Date()
              });

              resultadosProceso.push({
                fila: estudiante.fila,
                nombre: estudianteNormalizado.nombre,
                codigo: estudianteNormalizado.codigo,
                status: 'success',
                id: docRef.id
              });

              // Pequeña pausa para no sobrecargar
              await new Promise(resolve => setTimeout(resolve, 150));

            } catch (error) {
              console.error(`Error procesando estudiante ${estudiante.codigo}:`, error);
              resultadosProceso.push({
                fila: estudiante.fila,
                nombre: estudiante.nombre,
                codigo: estudiante.codigo,
                status: 'error',
                error: error.message
              });
            }
          }

          setResultados(resultadosProceso);
          const exitosos = resultadosProceso.filter(r => r.status === 'success').length;
          const errores = resultadosProceso.filter(r => r.status === 'error').length;
          const duplicados = resultadosProceso.filter(r => r.error && r.error.includes('Duplicado')).length;
          
          setMensaje(`✅ Proceso completado: ${exitosos} exitosos, ${errores} errores (${duplicados} duplicados omitidos)`);

        } catch (error) {
          console.error("Error procesando Excel:", error);
          setMensaje("❌ Error al procesar el archivo Excel");
        } finally {
          setProcesandoMasivo(false);
        }
      };

      reader.readAsArrayBuffer(archivo);

    } catch (error) {
      console.error("Error:", error);
      setMensaje("❌ Error al procesar el archivo");
      setProcesandoMasivo(false);
    }
  };

  const descargarQR = () => {
    if (!qrDataUrl || !qrPayload) return;
    
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR_${qrPayload.codigo}_${qrPayload.nombre.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const regenerarQR = async () => {
    if (!qrPayload) return;
    
    try {
      setCargando(true);
      setMensaje("🔄 Regenerando código QR...");
      
      const nuevoDataUrl = await QRCode.toDataURL(qrPayload.codigo, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 300,
        color: { dark: themeStyles.textPrimary, light: "#ffffff" },
      });

      await updateDoc(doc(db, "estudiantes", qrPayload.uid), {
        qrImage: nuevoDataUrl,
        fechaQR: new Date()
      });

      setQrDataUrl(nuevoDataUrl);
      setMensaje("✅ Código QR regenerado y actualizado");
    } catch (error) {
      console.error("Error al regenerar QR:", error);
      setMensaje("❌ Error al regenerar el código QR");
    } finally {
      setCargando(false);
    }
  };

  const descargarPlantillaExcel = () => {
    const plantilla = [
      ['NOMBRE', 'CODIGO', 'CURSO', 'ESCUELA', 'FACULTAD', 'TIPO'],
      ['Miguel Martinez', 'U12345', 'Computación I', 'Sistemas', 'Ingeniería', 'alumno'],
      ['Ana Torres', 'U67890', 'Matemática I', 'Matemática', 'Ciencias', 'externo'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes');
    XLSX.writeFile(wb, 'plantilla_estudiantes.xlsx');
  };

  if (resultados.length > 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: themeStyles.textPrimary }}>
              <CheckCircle size={22} className="text-green-600" />
              Resultados de carga masiva
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">{mensaje}</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 border">Fila</th>
                  <th className="text-left p-2 border">Nombre</th>
                  <th className="text-left p-2 border">Código</th>
                  <th className="text-left p-2 border">Estado</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((resultado, index) => (
                  <tr key={index} className={resultado.status === 'success' ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="p-2 border">{resultado.fila}</td>
                    <td className="p-2 border">{resultado.nombre}</td>
                    <td className="p-2 border">{resultado.codigo}</td>
                    <td className="p-2 border flex items-center gap-2">
                      {resultado.status === 'success' ? (
                        <>
                          <CheckCircle size={16} className="text-green-600" />
                          <span className="text-green-700">Registrado con QR</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} className="text-red-600" />
                          <span className="text-red-700 text-xs">
                            {resultado.error?.includes('Duplicado') ? (
                              <span className="text-orange-700">🔄 Duplicado omitido</span>
                            ) : (
                              `Error: ${resultado.error}`
                            )}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setResultados([]);
                setModoMasivo(false);
                setArchivo(null);
                setMensaje("");
              }}
              className="flex items-center gap-2 text-white px-4 py-2 rounded-md transition-colors"
              style={{ backgroundColor: themeStyles.primary, hover: { backgroundColor: themeStyles.secondary } }}
            >
              <UserPlus size={18} />
              Nuevo registro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!qrDataUrl && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold" style={{ color: themeStyles.textPrimary }}>
              Registro de Estudiantes
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Botones de modo - Solo mostrar ambos si es docente logueado */}
          {esDocenteLogueado ? (
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setModoMasivo(false)}
                className={`flex-1 flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !modoMasivo
                    ? 'bg-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                style={{ color: !modoMasivo ? themeStyles.primary : undefined }}
              >
                <UserPlus size={18} />
                Registro Individual
              </button>
              <button
                onClick={() => setModoMasivo(true)}
                className={`flex-1 flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  modoMasivo
                    ? 'bg-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                style={{ color: modoMasivo ? themeStyles.primary : undefined }}
              >
                <FileSpreadsheet size={18} />
                Carga Masiva (Excel)
              </button>
            </div>
          ) : null}

          {(!modoMasivo || !esDocenteLogueado) ? (
            // Formulario individual
            <form onSubmit={registrar} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
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

              <button
                type="submit"
                disabled={cargando}
                className={`w-full py-3 rounded-md font-semibold text-white transition-colors ${
                  cargando ? "bg-sky-400 cursor-not-allowed" : "bg-sky-700 hover:bg-sky-800"
                }`}
                style={{ backgroundColor: cargando ? themeStyles.secondary : themeStyles.primary, hover: { backgroundColor: themeStyles.secondary } }}
              >
                {cargando ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Registrando...
                  </div>
                ) : (
                  "Registrar estudiante"
                )}
              </button>
            </form>
          ) : esDocenteLogueado && modoMasivo ? (
            // Carga masiva - Solo para docentes
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Carga masiva desde Excel
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Sube un archivo Excel (.xlsx, .xls) o CSV con los datos de los estudiantes
                </p>
                
                <div className="flex flex-col items-center gap-4">
                  <label className="flex items-center gap-2 text-white px-4 py-2 rounded-md transition-colors cursor-pointer"
                    style={{ backgroundColor: themeStyles.primary, hover: { backgroundColor: themeStyles.secondary } }}>
                    <Upload size={18} />
                    Seleccionar archivo
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={manejarArchivoExcel}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    onClick={descargarPlantillaExcel}
                    className="text-sm underline"
                    style={{ color: themeStyles.primary, hover: { color: themeStyles.secondary } }}
                  >
                    📥 Descargar plantilla de Excel
                  </button>
                </div>
              </div>

              {archivo && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={20} className="text-green-600" />
                      <span className="text-green-800 font-medium">
                        {archivo.name}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setArchivo(null);
                        setMensaje("");
                      }}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              {procesandoMasivo && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 size={20} className="text-blue-600 animate-spin" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm text-blue-800 mb-1">
                        <span>Procesando estudiantes...</span>
                        <span>{progreso.actual} / {progreso.total}</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(progreso.actual / progreso.total) * 100}%`,
                            backgroundColor: themeStyles.primary
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {archivo && !procesandoMasivo && (
                <button
                  onClick={procesarArchivoExcel}
                  disabled={procesandoMasivo}
                  className="w-full py-3 text-white rounded-md font-semibold transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: themeStyles.primary, hover: { backgroundColor: themeStyles.secondary } }}
                >
                  <FileSpreadsheet size={18} />
                  Procesar archivo y crear códigos QR
                </button>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h4 className="font-medium text-yellow-800 mb-2">
                  📋 Formato del archivo Excel:
                </h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• <strong>NOMBRE</strong>: Nombre completo del estudiante</li>
                  <li>• <strong>CODIGO</strong>: Código USS del estudiante (ej: U20123456)</li>
                  <li>• <strong>CURSO</strong>: Nombre del curso</li>
                  <li>• <strong>ESCUELA</strong>: Escuela académica</li>
                  <li>• <strong>FACULTAD</strong>: Facultad (opcional)</li>
                  <li>• <strong>TIPO</strong>: "alumno" o "externo" (opcional, por defecto "alumno")</li>
                </ul>
                <div className="mt-3 p-2 bg-yellow-100 rounded border-l-4 border-yellow-400">
                  <p className="text-xs text-yellow-800">
                    <strong>⚠️ Nota:</strong> Se verificarán duplicados automáticamente. 
                    No se registrarán estudiantes con el mismo código o nombre (ignorando mayúsculas/acentos).
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {mensaje && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-center text-blue-800">{mensaje}</p>
            </div>
          )}
        </div>
      )}

      {qrPayload && qrDataUrl && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-2 mb-6">
            <QrCode size={20} style={{ color: themeStyles.primary }} />
            <h3 className="text-lg font-semibold" style={{ color: themeStyles.textPrimary }}>
              Código QR generado
            </h3>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <img
                src={qrDataUrl}
                alt={`QR de ${qrPayload.nombre}`}
                className="w-[250px] h-[250px] rounded-md"
              />
            </div>
            
            <div className="text-center">
              <h4 className="font-semibold text-gray-800 text-lg">
                {qrPayload.nombre}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Código USS:</strong> {qrPayload.codigo}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Curso:</strong> {qrPayload.curso}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Facultad:</strong> {qrPayload.facultad}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Escuela:</strong> {qrPayload.escuela}
              </p>
              
              {qrPayload.tipo === "externo" ? (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-2 px-2 py-1 bg-gray-100 rounded-full">
                  <Users size={12} /> Participante Externo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded-full"
                  style={{ color: themeStyles.primary, backgroundColor: `${themeStyles.primary}1A` }}>
                  <GraduationCap size={12} /> Alumno USS
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={descargarQR}
                className="flex items-center gap-2 text-white px-4 py-2 rounded-md transition-colors"
                style={{ backgroundColor: themeStyles.primary, hover: { backgroundColor: themeStyles.secondary } }}
              >
                <Download size={18} />
                Descargar QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}