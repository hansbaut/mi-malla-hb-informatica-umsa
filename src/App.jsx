import { useState, useRef, useEffect } from "react";
import mallaData from "./data/malla.json";

// --- Claves de localStorage ---
const STORAGE_KEY = "malla-informatica-progreso";
const STORAGE_KEY_TS = "malla-informatica-tecnico-superior";
const STORAGE_KEY_ELECTIVAS = "malla-informatica-electivas-elegidas";
const STORAGE_KEY_TEMA = "malla-informatica-tema";

// --- Diccionario código -> nombre ---
const nombresPorCodigo = {};
mallaData.semestres.forEach((sem) => sem.materias.forEach((m) => (nombresPorCodigo[m.codigo] = m.nombre)));
mallaData.tecnicosSuperiores.forEach((t) => t.materias.forEach((m) => (nombresPorCodigo[m.codigo] = m.nombre)));
mallaData.electivasMencion.forEach((m) => (nombresPorCodigo[m.codigo] = m.nombre));

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
  aprobada: "bg-green-100 border-green-400 dark:bg-green-900/40 dark:border-green-600",
  habilitada:
    "bg-amber-100 border-amber-400 hover:border-amber-500 dark:bg-amber-900/30 dark:border-amber-600 dark:hover:border-amber-500",
  bloqueada: "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700",
};

function agruparPorAnio(semestres) {
  const anios = [];
  for (let i = 0; i < semestres.length; i += 2) {
    anios.push({ nombre: `Año ${anios.length + 1}`, semestres: semestres.slice(i, i + 2) });
  }
  return anios;
}

const ELEC_TS = ["ELEC-1", "ELEC-2"];
const ELEC_MENCION = ["ELEC-3", "ELEC-4", "ELEC-5", "ELEC-6"];

function buscarComodin(codigo) {
  for (const sem of mallaData.semestres) {
    const found = sem.materias.find((m) => m.codigo === codigo);
    if (found) return found;
  }
  return null;
}

function resolverComodin(materiaOriginal, tsSeleccionado, electivasElegidas) {
  if (!materiaOriginal.esComodin) return materiaOriginal;

  if (ELEC_TS.includes(materiaOriginal.codigo)) {
    if (!tsSeleccionado) return materiaOriginal;
    const track = mallaData.tecnicosSuperiores.find((t) => t.nombre === tsSeleccionado);
    if (!track) return materiaOriginal;
    return materiaOriginal.codigo === "ELEC-1" ? track.materias[0] : track.materias[1];
  }

  if (ELEC_MENCION.includes(materiaOriginal.codigo)) {
    const elegido = electivasElegidas[materiaOriginal.codigo];
    if (!elegido) return materiaOriginal;
    const real = mallaData.electivasMencion.find((m) => m.codigo === elegido);
    if (!real) return materiaOriginal;
    return { ...real, prerequisitos: [], requisitoEspecial: materiaOriginal.requisitoEspecial };
  }

  return materiaOriginal;
}

function Subtitulo({ materia }) {
  if (materia.requisitoEspecial) {
    return <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">{materia.requisitoEspecial}</p>;
  }
  if (!materia.prerequisitos || materia.prerequisitos.length === 0) {
    return <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">Sin prerrequisitos</p>;
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {materia.prerequisitos.map((codigo) => (
        <span
          key={codigo}
          className="text-[10px] font-mono bg-gray-200 text-gray-600 rounded px-1.5 py-0.5 dark:bg-gray-700 dark:text-gray-300"
        >
          {codigo}
        </span>
      ))}
    </div>
  );
}

function MateriaCard({ materia, estado, onClick }) {
  const interactiva = estado !== "bloqueada";
  return (
    <div
      onClick={onClick}
      className={`min-h-[76px] border rounded-lg px-3 py-2 flex flex-col justify-between gap-1 transition-all duration-150 ${
        interactiva ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      } ${estilos[estado]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{materia.codigo}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{materia.nombre}</p>
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

function InterruptorTema({ modoOscuro, onToggle }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={modoOscuro}
      title={modoOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="relative inline-flex items-center h-7 w-14 shrink-0 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 transition-colors"
    >
      <span className="absolute left-1.5 text-[10px] leading-none select-none">☀️</span>
      <span className="absolute right-1.5 text-[10px] leading-none select-none">🌙</span>
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white dark:bg-gray-950 shadow-sm border border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ${
          modoOscuro ? "translate-x-8" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const COLORES_CONFETTI = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"];

function Confetti({ cantidad = 70 }) {
  const [piezas] = useState(() =>
    Array.from({ length: cantidad }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORES_CONFETTI[i % COLORES_CONFETTI.length],
      duracion: 2.5 + Math.random() * 1.5,
      retraso: Math.random() * 0.6,
    }))
  );

  return (
    <div className="fixed inset-0 overflow-hidden z-[60] pointer-events-none" aria-hidden="true">
      {piezas.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDuration: `${p.duracion}s`,
            animationDelay: `${p.retraso}s`,
          }}
        />
      ))}
    </div>
  );
}

function ModalFelicitacion({ onCerrar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Confetti />
      <div className="relative z-10 max-w-md w-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-8 text-center shadow-xl">
        <p className="text-5xl mb-3">🎓</p>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-50 mb-2">¡Felicidades!</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
          Completaste el 100% del plan de estudios de Informática — Desarrollo de Software e Innovación
          Tecnológica.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          No fue fácil, y llevó tiempo real de esfuerzo. Este logro es tuyo.
        </p>
        <button
          onClick={onCerrar}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function SeccionTecnicoSuperior({ tsSeleccionado, setTsSeleccionado, aprobadas, toggle }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">
          Al elegir una salida, sus materias reemplazan automáticamente "Electiva I" y "Electiva II"
          del 5° y 6° semestre, arriba en tu plan.
        </p>
        <select
          value={tsSeleccionado ?? ""}
          onChange={(e) => setTsSeleccionado(e.target.value || null)}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
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
              className={`w-full rounded-lg p-2 transition-shadow ${
                seleccionado ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3
                  onClick={() => setTsSeleccionado(track.nombre)}
                  className="text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {track.nombre}
                </h3>
                {seleccionado && (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 dark:bg-blue-900/40 dark:text-blue-300">
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

const ETIQUETAS_SLOT = {
  "ELEC-3": { nombre: "Electiva III", semestre: "7° semestre" },
  "ELEC-4": { nombre: "Electiva IV", semestre: "7° semestre" },
  "ELEC-5": { nombre: "Electiva V", semestre: "8° semestre" },
  "ELEC-6": { nombre: "Electiva VI", semestre: "8° semestre" },
};

function SeccionElectivasMencion({ electivasElegidas, setElectivasElegidas, tsSeleccionado, aprobadas, toggle }) {
  const setSlot = (slot, codigo) => {
    setElectivasElegidas((prev) => ({ ...prev, [slot]: codigo || null }));
  };

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 max-w-xl">
        Elige qué electiva de tu mención va en cada casillero del 7° y 8° semestre. Una vez elegida,
        se refleja arriba en el Plan de estudios. No puedes elegir la misma electiva en dos
        casilleros distintos.
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-4 max-w-xl">
        Nota: esto arma tu plan ideal — en la práctica, la universidad podría no abrir una electiva
        puntual si no se junta un mínimo de estudiantes inscritos.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ELEC_MENCION.map((codigoSlot) => {
          const comodin = buscarComodin(codigoSlot);
          if (!comodin) return null;
          const elegido = electivasElegidas[codigoSlot];
          const materiaResuelta = resolverComodin(comodin, tsSeleccionado, electivasElegidas);
          const estado = getEstado(materiaResuelta, aprobadas);
          const elegidasEnOtros = ELEC_MENCION.filter((s) => s !== codigoSlot)
            .map((s) => electivasElegidas[s])
            .filter(Boolean);
          const etiqueta = ETIQUETAS_SLOT[codigoSlot];

          return (
            <div key={codigoSlot} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {etiqueta.nombre}{" "}
                  <span className="font-normal text-gray-400 dark:text-gray-500">· {etiqueta.semestre}</span>
                </span>
              </div>
              <select
                value={elegido ?? ""}
                onChange={(e) => setSlot(codigoSlot, e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-800 mb-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="">Elegir materia...</option>
                {mallaData.electivasMencion
                  .filter((m) => !elegidasEnOtros.includes(m.codigo))
                  .map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.codigo} — {m.nombre}
                    </option>
                  ))}
              </select>
              <MateriaCard
                materia={materiaResuelta}
                estado={estado}
                onClick={() => elegido && estado !== "bloqueada" && toggle(materiaResuelta)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SUBTABS = [
  { id: "ts", label: "Técnico Superior" },
  { id: "electivas", label: "Electivas de mención" },
];

export default function App() {
  const [aprobadas, setAprobadas] = useState(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      return guardado ? new Set(JSON.parse(guardado)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [subTab, setSubTab] = useState("ts");
  const [tsSeleccionado, setTsSeleccionado] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TS) || null;
    } catch {
      return null;
    }
  });
  const [electivasElegidas, setElectivasElegidas] = useState(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY_ELECTIVAS);
      return guardado ? JSON.parse(guardado) : {};
    } catch {
      return {};
    }
  });
  const [modoOscuro, setModoOscuro] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TEMA) === "oscuro";
    } catch {
      return false;
    }
  });
  const [mostrarFestejo, setMostrarFestejo] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...aprobadas]));
  }, [aprobadas]);

  useEffect(() => {
    if (tsSeleccionado) localStorage.setItem(STORAGE_KEY_TS, tsSeleccionado);
    else localStorage.removeItem(STORAGE_KEY_TS);
  }, [tsSeleccionado]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ELECTIVAS, JSON.stringify(electivasElegidas));
  }, [electivasElegidas]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", modoOscuro);
    localStorage.setItem(STORAGE_KEY_TEMA, modoOscuro ? "oscuro" : "claro");
  }, [modoOscuro]);

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
      setElectivasElegidas({});
    }
  };

  const coreCourses = mallaData.semestres.flatMap((s) => s.materias).filter((m) => !m.esComodin);
  const totalCore = coreCourses.length;
  const aprobadasCore = coreCourses.filter((m) => aprobadas.has(m.codigo)).length;
  const pct = totalCore ? Math.round((aprobadasCore / totalCore) * 100) : 0;

  // Detecta el MOMENTO en que pasas de <100% a 100% (no se dispara si ya cargaste con 100% hecho)
  const pctAnteriorRef = useRef(pct);
  useEffect(() => {
    if (pct === 100 && pctAnteriorRef.current < 100) {
      setMostrarFestejo(true);
    }
    pctAnteriorRef.current = pct;
  }, [pct]);

  const anios = agruparPorAnio(mallaData.semestres);

  const irASeccion = (destino) => {
    setSubTab(destino);
    document.getElementById("seccion-inferior")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-950 min-h-screen transition-colors">
      {mostrarFestejo && <ModalFelicitacion onCerrar={() => setMostrarFestejo(false)} />}

      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-50">{mallaData.carrera}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mención: {mallaData.mencion}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 shadow-sm">
            <div className="w-40 h-2.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 to-green-500 transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap tabular-nums">
              {pct}%
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap hidden sm:inline">
              {aprobadasCore}/{totalCore}
            </span>
          </div>
          <InterruptorTema modoOscuro={modoOscuro} onToggle={() => setModoOscuro((v) => !v)} />
          <button
            onClick={reset}
            className="text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Reiniciar
          </button>
        </div>
      </div>

      {/* Panel del tablero */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4 shadow-sm">
        <div className="malla-scroll flex gap-6 overflow-x-auto pb-3">
          {anios.map((anio) => (
            <div key={anio.nombre} className="flex flex-col">
              <div className="mb-2 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 py-1.5 text-center">
                <h2 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  {anio.nombre}
                </h2>
              </div>
              <div className="flex gap-4">
                {anio.semestres.map((sem) => (
                  <div
                    key={sem.numero}
                    className="w-64 shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden flex flex-col"
                  >
                    <div className="px-3 py-2 flex items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{sem.nombre}</h3>
                      <div className="flex items-center gap-2">
                        <CheckboxSemestre sem={sem} aprobadas={aprobadas} onToggle={() => toggleSemestre(sem)} />
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 dark:bg-gray-700 dark:text-gray-300">
                          {sem.materias.length}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 p-2">
                      {sem.materias.map((materiaOriginal) => {
                        const esTS = ELEC_TS.includes(materiaOriginal.codigo);
                        const esMencion = ELEC_MENCION.includes(materiaOriginal.codigo);
                        const sinElegir =
                          materiaOriginal.esComodin &&
                          ((esTS && !tsSeleccionado) || (esMencion && !electivasElegidas[materiaOriginal.codigo]));
                        const materia = resolverComodin(materiaOriginal, tsSeleccionado, electivasElegidas);
                        const estado = sinElegir ? "habilitada" : getEstado(materia, aprobadas);
                        return (
                          <MateriaCard
                            key={materia.codigo}
                            materia={materia}
                            estado={estado}
                            onClick={() => {
                              if (sinElegir) {
                                irASeccion(esTS ? "ts" : "electivas");
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
      </div>

      {/* Sección inferior: sub-pestañas */}
      <div id="seccion-inferior" className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-1 mb-4">
          {SUBTABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`text-sm font-medium rounded-md px-3 py-1.5 transition-colors ${
                subTab === t.id
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab === "ts" && (
          <SeccionTecnicoSuperior
            tsSeleccionado={tsSeleccionado}
            setTsSeleccionado={setTsSeleccionado}
            aprobadas={aprobadas}
            toggle={toggle}
          />
        )}

        {subTab === "electivas" && (
          <SeccionElectivasMencion
            electivasElegidas={electivasElegidas}
            setElectivasElegidas={setElectivasElegidas}
            tsSeleccionado={tsSeleccionado}
            aprobadas={aprobadas}
            toggle={toggle}
          />
        )}
      </div>
    </div>
  );
}

