import { useState, useRef, useEffect } from "react";
import mallaData from "./data/malla.json";

// --- Diccionario código -> nombre ---
const nombresPorCodigo = {};
mallaData.semestres.forEach((sem) => sem.materias.forEach((m) => (nombresPorCodigo[m.codigo] = m.nombre)));
mallaData.tecnicosSuperiores.forEach((t) => t.materias.forEach((m) => (nombresPorCodigo[m.codigo] = m.nombre)));

// --- Lógica de "semestre vencido" ---
const ORDINAL_A_NUMERO = {
  primer: 1, segundo: 2, tercer: 3, cuarto: 4, quinto: 5,
  sexto: 6, séptimo: 7, septimo: 7, octavo: 8, noveno: 9,
};

function parseSemestreVencido(texto) {
  if (!texto) return null;
  const match = texto.match(/^(\S+) semestre vencido$/i);
  if (!match) return null;
  return ORDINAL_A_NUMERO[match[1].toLowerCase()] ?? null;
}

function semestreVencido(numeroSemestre, aprobadas) {
  const materiasRequeridas = mallaData.semestres
    .filter((s) => s.numero <= numeroSemestre)
    .flatMap((s) => s.materias)
    .filter((m) => !m.esComodin);
  return materiasRequeridas.every((m) => aprobadas.has(m.codigo));
}

function getEstado(materia, aprobadas) {
  if (aprobadas.has(materia.codigo)) return "aprobada";

  const faltanPrereq = (materia.prerequisitos || []).filter((p) => !aprobadas.has(p));
  if (faltanPrereq.length > 0) return "bloqueada";

  const semestreRequerido = parseSemestreVencido(materia.requisitoEspecial);
  if (semestreRequerido && !semestreVencido(semestreRequerido, aprobadas)) {
    return "bloqueada";
  }

  return "habilitada";
}

const estilos = {
  aprobada: "bg-green-100 border-green-400",
  habilitada: "bg-amber-100 border-amber-400 hover:border-amber-500",
  bloqueada: "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed",
};

function agruparPorAnio(semestres) {
  const anios = [];
  for (let i = 0; i < semestres.length; i += 2) {
    anios.push({ nombre: `Año ${anios.length + 1}`, semestres: semestres.slice(i, i + 2) });
  }
  return anios;
}

function resolverMateria(materia, tsSeleccionado) {
  if (!materia.esComodin || !tsSeleccionado) return materia;
  const track = mallaData.tecnicosSuperiores.find((t) => t.nombre === tsSeleccionado);
  if (!track) return materia;
  if (materia.codigo === "ELEC-1") return track.materias[0];
  if (materia.codigo === "ELEC-2") return track.materias[1];
  return materia;
}

function Subtitulo({ materia }) {
  if (materia.requisitoEspecial) {
    return <p className="text-[10px] text-gray-500 italic">{materia.requisitoEspecial}</p>;
  }
  if (!materia.prerequisitos || materia.prerequisitos.length === 0) {
    return <p className="text-[10px] text-gray-400 italic">Sin prerrequisitos</p>;
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {materia.prerequisitos.map((codigo) => (
        <span key={codigo} className="text-[10px] font-mono bg-gray-200 text-gray-600 rounded px-1.5 py-0.5">
          {codigo}
        </span>
      ))}
    </div>
  );
}

function MateriaCard({ materia, estado, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`min-h-[76px] border rounded-lg px-3 py-2 flex flex-col justify-between gap-1 transition-colors ${
        estado === "bloqueada" ? "" : "cursor-pointer"
      } ${estilos[estado]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono text-gray-500">{materia.codigo}</p>
          <p className="text-sm font-medium text-gray-800">{materia.nombre}</p>
        </div>
        <input
          type="checkbox"
          checked={estado === "aprobada"}
          readOnly
          disabled={estado === "bloqueada"}
          className="mt-0.5 h-4 w-4 accent-green-600 shrink-0"
        />
      </div>
      <Subtitulo materia={materia} />
    </div>
  );
}

function CheckboxSemestre({ sem, aprobadas, onToggle }) {
  const ref = useRef(null);
  const codigos = sem.materias.map((m) => m.codigo);
  const cantidadAprobadas = codigos.filter((c) => aprobadas.has(c)).length;
  const todas = cantidadAprobadas === codigos.length;
  const ninguna = cantidadAprobadas === 0;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !todas && !ninguna;
  }, [todas, ninguna]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={todas}
      onChange={onToggle}
      title={todas ? "Desmarcar todo el semestre" : "Marcar todo el semestre"}
      className="h-3.5 w-3.5 accent-blue-600 cursor-pointer"
    />
  );
}

// Sección "Elige tu Técnico Superior" - ahora vive DEBAJO del tablero, no en pestaña aparte
function SeccionTecnicoSuperior({ tsSeleccionado, setTsSeleccionado, aprobadas, toggle }) {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Elige tu Técnico Superior</h2>
          <p className="text-sm text-gray-500 mt-0.5 max-w-xl">
            Al elegir una salida, sus materias reemplazan automáticamente "Electiva I" y "Electiva II"
            del 5° y 6° semestre, arriba en tu plan.
          </p>
        </div>
        <select
          value={tsSeleccionado ?? ""}
          onChange={(e) => setTsSeleccionado(e.target.value || null)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">Sin elegir</option>
          {mallaData.tecnicosSuperiores.map((track) => (
            <option key={track.nombre} value={track.nombre}>
              {track.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {mallaData.tecnicosSuperiores.map((track) => {
          const seleccionado = tsSeleccionado === track.nombre;
          return (
            <div
              key={track.nombre}
              className={`w-full rounded-lg p-2 transition-shadow ${seleccionado ? "ring-2 ring-blue-500" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3
                  onClick={() => setTsSeleccionado(track.nombre)}
                  className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-blue-600"
                >
                  {track.nombre}
                </h3>
                {seleccionado && (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                    Elegido
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {track.materias.map((materia) => {
                  const estado = getEstado(materia, aprobadas);
                  return (
                    <MateriaCard
                      key={materia.codigo}
                      materia={materia}
                      estado={estado}
                      onClick={() => estado !== "bloqueada" && toggle(materia)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ahora solo 2 pestañas: el Técnico Superior quedó integrado dentro de "Plan de estudios"
const TABS = [
  { id: "plan", label: "Plan de estudios" },
  { id: "electivas", label: "Electivas de mención" },
];

const STORAGE_KEY = "malla-informatica-progreso";
const STORAGE_KEY_TS = "malla-informatica-tecnico-superior";

export default function App() {
  const [aprobadas, setAprobadas] = useState(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      return guardado ? new Set(JSON.parse(guardado)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [tab, setTab] = useState("plan");
  const [tsSeleccionado, setTsSeleccionado] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TS) || null;
    } catch {
      return null;
    }
  });

  // Cada vez que cambian las aprobadas, las vuelve a guardar
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...aprobadas]));
  }, [aprobadas]);

  // Cada vez que cambia el Técnico Superior elegido, lo vuelve a guardar
  useEffect(() => {
    if (tsSeleccionado) {
      localStorage.setItem(STORAGE_KEY_TS, tsSeleccionado);
    } else {
      localStorage.removeItem(STORAGE_KEY_TS);
    }
  }, [tsSeleccionado]);

  const toggle = (materia) => {
    setAprobadas((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(materia.codigo) ? nuevo.delete(materia.codigo) : nuevo.add(materia.codigo);
      return nuevo;
    });
  };

  const toggleSemestre = (sem) => {
    const codigos = sem.materias.map((m) => m.codigo);
    const todasAprobadas = codigos.every((c) => aprobadas.has(c));
    setAprobadas((prev) => {
      const nuevo = new Set(prev);
      codigos.forEach((c) => (todasAprobadas ? nuevo.delete(c) : nuevo.add(c)));
      return nuevo;
    });
  };

  const reset = () => {
    if (confirm("¿Reiniciar todo tu progreso?")) {
      setAprobadas(new Set());
      setTsSeleccionado(null);
    }
  };

  const coreCourses = mallaData.semestres.flatMap((s) => s.materias).filter((m) => !m.esComodin);
  const totalCore = coreCourses.length;
  const aprobadasCore = coreCourses.filter((m) => aprobadas.has(m.codigo)).length;
  const pct = totalCore ? Math.round((aprobadasCore / totalCore) * 100) : 0;

  const anios = agruparPorAnio(mallaData.semestres);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{mallaData.carrera}</h1>
          <p className="text-sm text-gray-500">Mención: {mallaData.mencion}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
            {pct}% ({aprobadasCore}/{totalCore})
          </span>
          <button
            onClick={reset}
            className="text-xs font-mono text-gray-500 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-100"
          >
            Reiniciar
          </button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-sm font-medium rounded-md px-3 py-1.5 transition-colors ${
              tab === t.id ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Plan de estudios (incluye el tablero Y la elección de Técnico Superior debajo) */}
      {tab === "plan" && (
        <div>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {anios.map((anio) => (
              <div key={anio.nombre}>
                <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">{anio.nombre}</h2>
                <div className="flex gap-4">
                  {anio.semestres.map((sem) => (
                    <div key={sem.numero} className="w-64 shrink-0">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <h3 className="text-sm font-semibold text-gray-700">{sem.nombre}</h3>
                        <div className="flex items-center gap-2">
                          <CheckboxSemestre sem={sem} aprobadas={aprobadas} onToggle={() => toggleSemestre(sem)} />
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                            {sem.materias.length}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {sem.materias.map((materiaOriginal) => {
                          const esPlaceholderSinElegir =
                            materiaOriginal.esComodin &&
                            !tsSeleccionado &&
                            (materiaOriginal.codigo === "ELEC-1" || materiaOriginal.codigo === "ELEC-2");
                          const materia = resolverMateria(materiaOriginal, tsSeleccionado);
                          const estado = esPlaceholderSinElegir ? "habilitada" : getEstado(materia, aprobadas);
                          return (
                            <MateriaCard
                              key={materia.codigo}
                              materia={materia}
                              estado={estado}
                              onClick={() => {
                                if (esPlaceholderSinElegir) {
                                  // Ya no cambia de pestaña: lleva la vista directo a la sección de abajo
                                  document
                                    .getElementById("seccion-tecnico-superior")
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                } else if (estado !== "bloqueada") {
                                  toggle(materia);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div id="seccion-tecnico-superior">
            <SeccionTecnicoSuperior
              tsSeleccionado={tsSeleccionado}
              setTsSeleccionado={setTsSeleccionado}
              aprobadas={aprobadas}
              toggle={toggle}
            />
          </div>
        </div>
      )}

      {/* Electivas de mención */}
      {tab === "electivas" && (
        <div>
          <p className="text-sm text-gray-500 mb-4 max-w-xl">
            Pool de electivas de tu mención. Se habilitan al tener el sexto semestre vencido; ocupan
            las casillas "Electiva" del 7° y 8° semestre.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {mallaData.electivasMencion.map((materia) => {
              const estado = aprobadas.has(materia.codigo) ? "aprobada" : "habilitada";
              return (
                <MateriaCard
                  key={materia.codigo}
                  materia={{ ...materia, prerequisitos: [] }}
                  estado={estado}
                  onClick={() => toggle(materia)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

