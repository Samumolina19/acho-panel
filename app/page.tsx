"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type Device = {
  id: string;
  device_code: string | null;
  display_code: string | null;
  device_name: string | null;
  platform: string | null;
  app_version: string | null;
  is_active: boolean;
  last_seen?: string | null;
};

type XtreamList = {
  id: string;
  alias: string;
  server: string;
  username: string;
  password: string;
  is_active: boolean;
  created_at?: string | null;
};

type Assignment = {
  id: string;
  device_id: string;
  xtream_list_id: string;
  created_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function Page() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [lists, setLists] = useState<XtreamList[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [alias, setAlias] = useState("");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedListId, setSelectedListId] = useState("");

  const [activeTab, setActiveTab] = useState<"devices" | "lists" | "assignments">("devices");
  const [showOnlyActiveDevices, setShowOnlyActiveDevices] = useState(false);
  const [showOnlyActiveLists, setShowOnlyActiveLists] = useState(false);

  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editAlias, setEditAlias] = useState("");
  const [editServer, setEditServer] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [manageDeviceId, setManageDeviceId] = useState<string | null>(null);
  const [manageListId, setManageListId] = useState("");

  const [remoteAlias, setRemoteAlias] = useState("");
  const [remoteServer, setRemoteServer] = useState("");
  const [remoteUsername, setRemoteUsername] = useState("");
  const [remotePassword, setRemotePassword] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");

    const [devicesRes, listsRes, assignmentsRes] = await Promise.all([
      supabase.from("devices").select("*").order("created_at", { ascending: false }),
      supabase.from("xtream_lists").select("*").order("created_at", { ascending: false }),
      supabase.from("device_list_assignments").select("*").order("created_at", { ascending: false }),
    ]);

    if (devicesRes.error) setError(devicesRes.error.message);
    if (listsRes.error) setError(listsRes.error.message);
    if (assignmentsRes.error) setError(assignmentsRes.error.message);

    setDevices((devicesRes.data as Device[]) || []);
    setLists((listsRes.data as XtreamList[]) || []);
    setAssignments((assignmentsRes.data as Assignment[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();

    return devices.filter((d) => {
      const text = [d.display_code, d.device_name, d.device_code, d.platform]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);
      const matchesActive = !showOnlyActiveDevices || d.is_active;

      return matchesSearch && matchesActive;
    });
  }, [devices, search, showOnlyActiveDevices]);

  const filteredLists = useMemo(() => {
    return lists.filter((l) => !showOnlyActiveLists || l.is_active);
  }, [lists, showOnlyActiveLists]);

  async function toggleDevice(id: string, active: boolean) {
    const { error } = await supabase.from("devices").update({ is_active: !active }).eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!alias || !server || !username || !password) {
      return alert("Completa todos los campos de la lista");
    }

    const { error } = await supabase.from("xtream_lists").insert({
      alias,
      server,
      username,
      password,
      is_active: true,
    });

    if (error) return alert(error.message);

    setAlias("");
    setServer("");
    setUsername("");
    setPassword("");
    loadAll();
  }

  async function toggleList(id: string, active: boolean) {
    const { error } = await supabase.from("xtream_lists").update({ is_active: !active }).eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  }

  async function deleteList(id: string) {
    if (!window.confirm("¿Eliminar esta lista?")) return;
    const { error } = await supabase.from("xtream_lists").delete().eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  }

  function startEditList(list: XtreamList) {
    setEditingListId(list.id);
    setEditAlias(list.alias);
    setEditServer(list.server);
    setEditUsername(list.username);
    setEditPassword(list.password);
  }

  function cancelEditList() {
    setEditingListId(null);
    setEditAlias("");
    setEditServer("");
    setEditUsername("");
    setEditPassword("");
  }

  async function saveEditedList(id: string) {
    if (!editAlias || !editServer || !editUsername || !editPassword) {
      return alert("Completa todos los campos para editar la lista");
    }

    const { error } = await supabase
      .from("xtream_lists")
      .update({
        alias: editAlias,
        server: editServer,
        username: editUsername,
        password: editPassword,
      })
      .eq("id", id);

    if (error) return alert(error.message);

    cancelEditList();
    loadAll();
  }

  async function assignList(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeviceId || !selectedListId) {
      return alert("Selecciona dispositivo y lista");
    }

    const exists = assignments.some(
      (a) => a.device_id === selectedDeviceId && a.xtream_list_id === selectedListId
    );
    if (exists) return alert("Esa lista ya está asignada a ese dispositivo");

    const { error } = await supabase.from("device_list_assignments").insert({
      device_id: selectedDeviceId,
      xtream_list_id: selectedListId,
    });

    if (error) return alert(error.message);

    setSelectedDeviceId("");
    setSelectedListId("");
    loadAll();
  }

  async function assignExistingListToDevice(deviceId: string, listId: string) {
    if (!deviceId || !listId) return;

    const exists = assignments.some(
      (a) => a.device_id === deviceId && a.xtream_list_id === listId
    );
    if (exists) return alert("Esa lista ya está asignada a ese dispositivo");

    const { error } = await supabase.from("device_list_assignments").insert({
      device_id: deviceId,
      xtream_list_id: listId,
    });

    if (error) return alert(error.message);

    setManageListId("");
    loadAll();
  }

  async function deleteAssignment(id: string) {
    if (!window.confirm("¿Quitar esta lista del dispositivo?")) return;
    const { error } = await supabase.from("device_list_assignments").delete().eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  }

  async function addRemoteListToDevice(deviceId: string) {
    if (!remoteAlias || !remoteServer || !remoteUsername || !remotePassword) {
      return alert("Completa todos los campos de la nueva lista remota");
    }

    const listRes = await supabase
      .from("xtream_lists")
      .insert({
        alias: remoteAlias,
        server: remoteServer,
        username: remoteUsername,
        password: remotePassword,
        is_active: true,
      })
      .select()
      .single();

    if (listRes.error || !listRes.data) {
      return alert(listRes.error?.message || "Error creando la lista");
    }

    const assignRes = await supabase.from("device_list_assignments").insert({
      device_id: deviceId,
      xtream_list_id: listRes.data.id,
    });

    if (assignRes.error) return alert(assignRes.error.message);

    setRemoteAlias("");
    setRemoteServer("");
    setRemoteUsername("");
    setRemotePassword("");
    loadAll();
  }

  function getDeviceAssignments(deviceId: string) {
    return assignments.filter((a) => a.device_id === deviceId);
  }

  function getList(listId: string) {
    return lists.find((l) => l.id === listId);
  }

  function getDeviceById(deviceId: string) {
    return devices.find((d) => d.id === deviceId);
  }

  const totalActiveDevices = devices.filter((d) => d.is_active).length;
  const totalActiveLists = lists.filter((l) => l.is_active).length;
  const managedDeviceAssignments = manageDeviceId ? getDeviceAssignments(manageDeviceId) : [];
  const availableListsForManagedDevice = manageDeviceId
    ? lists.filter((l) => !managedDeviceAssignments.some((a) => a.xtream_list_id === l.id))
    : lists;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerWrap}>
          <div>
            <h1 style={styles.title}>Panel Admin AchoTV</h1>
            <p style={styles.subtitle}>
              Gestión rápida de dispositivos y listas IPTV.
            </p>
          </div>
          <button onClick={loadAll} style={styles.buttonSecondary}>Recargar</button>
        </div>

        <div style={styles.statsGridCompact}>
          <div style={styles.statCardCompact}><div style={styles.statLabel}>Dispositivos</div><div style={styles.statValueSmall}>{devices.length}</div></div>
          <div style={styles.statCardCompact}><div style={styles.statLabel}>Activos</div><div style={styles.statValueSmall}>{totalActiveDevices}</div></div>
          <div style={styles.statCardCompact}><div style={styles.statLabel}>Listas</div><div style={styles.statValueSmall}>{lists.length}</div></div>
          <div style={styles.statCardCompact}><div style={styles.statLabel}>Listas activas</div><div style={styles.statValueSmall}>{totalActiveLists}</div></div>
        </div>

        {loading && <p style={styles.info}>Cargando...</p>}
        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.tabBar}>
          <button onClick={() => setActiveTab("devices")} style={activeTab === "devices" ? styles.tabButtonActive : styles.tabButton}>Dispositivos</button>
          <button onClick={() => setActiveTab("lists")} style={activeTab === "lists" ? styles.tabButtonActive : styles.tabButton}>Listas</button>
          <button onClick={() => setActiveTab("assignments")} style={activeTab === "assignments" ? styles.tabButtonActive : styles.tabButton}>Asignaciones</button>
        </div>

        {activeTab === "devices" && (
          <div style={{ ...styles.card, marginTop: 18 }}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.h2NoMargin}>Dispositivos</h2>
              <div style={styles.toolbarRight}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar"
                  style={{ ...styles.input, width: 220 }}
                />
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showOnlyActiveDevices}
                    onChange={(e) => setShowOnlyActiveDevices(e.target.checked)}
                  />
                  Solo activos
                </label>
              </div>
            </div>

            <div style={styles.compactTableWrap}>
              <div style={styles.tableHeader}>
                <div>Código</div>
                <div>Nombre</div>
                <div>Estado</div>
                <div>Último acceso</div>
                <div>Listas</div>
                <div>Acciones</div>
              </div>

              {filteredDevices.map((device) => {
                const deviceAssignments = getDeviceAssignments(device.id);
                return (
                  <div key={device.id} style={styles.tableRow}>
                    <div style={styles.cellStrong}>{device.display_code || "-"}</div>
                    <div>{device.device_name || "-"}</div>
                    <div>
                      <span style={device.is_active ? styles.badgeActiveMini : styles.badgeBlockedMini}>
                        {device.is_active ? "Activo" : "Bloqueado"}
                      </span>
                    </div>
                    <div>{formatDate(device.last_seen)}</div>
                    <div style={styles.cellListNames}>
                      {deviceAssignments.length === 0
                        ? "Sin listas"
                        : deviceAssignments.map((a) => getList(a.xtream_list_id)?.alias || "Sin alias").join(", ")}
                    </div>
                    <div style={styles.rowButtonsCompact}>
                      <button onClick={() => toggleDevice(device.id, device.is_active)} style={styles.smallPrimaryButton}>
                        {device.is_active ? "Off" : "On"}
                      </button>
                      <button
                        onClick={() => {
                          setManageDeviceId(device.id);
                          setManageListId("");
                          setRemoteAlias("");
                          setRemoteServer("");
                          setRemoteUsername("");
                          setRemotePassword("");
                        }}
                        style={styles.smallSecondaryButton}
                      >
                        Nueva
                      </button>
                      <button onClick={() => { setManageDeviceId(device.id); setManageListId(""); }} style={styles.smallSecondaryButton}>
                        Gestionar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "lists" && (
          <div style={{ ...styles.card, marginTop: 18 }}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.h2NoMargin}>Listas</h2>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOnlyActiveLists}
                  onChange={(e) => setShowOnlyActiveLists(e.target.checked)}
                />
                Solo activas
              </label>
            </div>

            <div style={styles.gridCompactTop}>
              <form onSubmit={createList} style={styles.formCompact}>
                <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias" style={styles.input} />
                <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="Servidor" style={styles.input} />
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" style={styles.input} />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" style={styles.input} />
                <button type="submit" style={styles.buttonPrimary}>Guardar</button>
              </form>
            </div>

            <div style={styles.compactTableWrap}>
              <div style={styles.tableHeaderLists}>
                <div>Alias</div>
                <div>Servidor</div>
                <div>Usuario</div>
                <div>Estado</div>
                <div>Acciones</div>
              </div>

              {filteredLists.map((list) => (
                <div key={list.id} style={styles.tableRowLists}>
                  {editingListId === list.id ? (
                    <>
                      <div><input value={editAlias} onChange={(e) => setEditAlias(e.target.value)} style={styles.inputCompact} /></div>
                      <div><input value={editServer} onChange={(e) => setEditServer(e.target.value)} style={styles.inputCompact} /></div>
                      <div><input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={styles.inputCompact} /></div>
                      <div>
                        <span style={list.is_active ? styles.badgeActiveMini : styles.badgeBlockedMini}>
                          {list.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <div style={styles.rowButtonsCompact}>
                        <button onClick={() => saveEditedList(list.id)} style={styles.smallPrimaryButton}>Guardar</button>
                        <button onClick={cancelEditList} style={styles.smallSecondaryButton}>Cancelar</button>
                      </div>
                      <div style={styles.fullRowPassword}><input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Contraseña" style={styles.inputCompactWide} /></div>
                    </>
                  ) : (
                    <>
                      <div style={styles.cellStrong}>{list.alias}</div>
                      <div style={styles.cellEllipsis}>{list.server}</div>
                      <div>{list.username}</div>
                      <div>
                        <span style={list.is_active ? styles.badgeActiveMini : styles.badgeBlockedMini}>
                          {list.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <div style={styles.rowButtonsCompact}>
                        <button onClick={() => startEditList(list)} style={styles.smallSecondaryButton}>Editar</button>
                        <button onClick={() => toggleList(list.id, list.is_active)} style={styles.smallSecondaryButton}>
                          {list.is_active ? "Off" : "On"}
                        </button>
                        <button onClick={() => deleteList(list.id)} style={styles.smallDangerButton}>Eliminar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "assignments" && (
          <div style={{ ...styles.card, marginTop: 18 }}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.h2NoMargin}>Asignaciones</h2>
            </div>

            <form onSubmit={assignList} style={styles.assignmentBar}>
              <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} style={styles.input}>
                <option value="">Selecciona dispositivo</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_code || d.device_name || d.id}
                  </option>
                ))}
              </select>

              <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} style={styles.input}>
                <option value="">Selecciona lista</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.alias}
                  </option>
                ))}
              </select>

              <button type="submit" style={styles.buttonPrimary}>Asignar</button>
            </form>

            <div style={styles.compactTableWrap}>
              <div style={styles.tableHeaderAssignments}>
                <div>Dispositivo</div>
                <div>Lista</div>
                <div>Servidor</div>
                <div>Acción</div>
              </div>

              {assignments.map((a) => {
                const device = getDeviceById(a.device_id);
                const list = getList(a.xtream_list_id);
                return (
                  <div key={a.id} style={styles.tableRowAssignments}>
                    <div>{device?.display_code || device?.device_name || "-"}</div>
                    <div style={styles.cellStrong}>{list?.alias || "Sin alias"}</div>
                    <div style={styles.cellEllipsis}>{list?.server || "-"}</div>
                    <div>
                      <button onClick={() => deleteAssignment(a.id)} style={styles.smallDangerButton}>Quitar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {manageDeviceId && (
          <div style={styles.modalBackdrop} onClick={() => setManageDeviceId(null)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.modalTitle}>Gestionar listas del dispositivo</div>
                  <div style={styles.modalSubtitle}>
                    {getDeviceById(manageDeviceId)?.display_code || getDeviceById(manageDeviceId)?.device_name || manageDeviceId}
                  </div>
                </div>
                <button onClick={() => setManageDeviceId(null)} style={styles.smallDangerButton}>Cerrar</button>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>Añadir lista nueva al dispositivo</div>
                <div style={styles.remoteFormGrid}>
                  <input value={remoteAlias} onChange={(e) => setRemoteAlias(e.target.value)} placeholder="Alias" style={styles.input} />
                  <input value={remoteServer} onChange={(e) => setRemoteServer(e.target.value)} placeholder="Servidor" style={styles.input} />
                  <input value={remoteUsername} onChange={(e) => setRemoteUsername(e.target.value)} placeholder="Usuario" style={styles.input} />
                  <input value={remotePassword} onChange={(e) => setRemotePassword(e.target.value)} placeholder="Contraseña" style={styles.input} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => addRemoteListToDevice(manageDeviceId)} style={styles.buttonPrimary}>Crear y asignar</button>
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>Añadir lista existente</div>
                <div style={styles.manageBar}>
                  <select value={manageListId} onChange={(e) => setManageListId(e.target.value)} style={styles.input}>
                    <option value="">Selecciona lista</option>
                    {availableListsForManagedDevice.map((l) => (
                      <option key={l.id} value={l.id}>{l.alias}</option>
                    ))}
                  </select>
                  <button onClick={() => assignExistingListToDevice(manageDeviceId, manageListId)} style={styles.buttonPrimary}>Añadir</button>
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>Listas actuales</div>
                <div style={styles.listWrap}>
                  {managedDeviceAssignments.length === 0 ? (
                    <div style={styles.muted}>Este dispositivo no tiene listas.</div>
                  ) : (
                    managedDeviceAssignments.map((a) => {
                      const list = getList(a.xtream_list_id);
                      return (
                        <div key={a.id} style={styles.assignmentRow}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{list?.alias || "Sin alias"}</div>
                            <div style={styles.mutedSmall}>{list?.server || "-"}</div>
                          </div>
                          <div style={styles.rowButtonsCompact}>
                            {list && <button onClick={() => startEditList(list)} style={styles.smallSecondaryButton}>Editar lista</button>}
                            <button onClick={() => deleteAssignment(a.id)} style={styles.smallDangerButton}>Quitar</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #081120 0%, #0b1220 100%)",
    color: "white",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: 1280,
    margin: "0 auto",
  },
  headerWrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: 800,
    marginBottom: 8,
  },
  subtitle: {
    color: "#9fb0c8",
    margin: 0,
  },
  statsGridCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  statCardCompact: {
    background: "#111827",
    borderRadius: 16,
    padding: 14,
    border: "1px solid #1f2937",
    boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
  },
  statLabel: {
    color: "#8ea0bb",
    fontSize: 13,
  },
  statValueSmall: {
    fontSize: 24,
    fontWeight: 800,
    marginTop: 6,
  },
  card: {
    background: "#111827",
    borderRadius: 22,
    padding: 20,
    border: "1px solid #1f2937",
    boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
  },
  tabBar: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  tabButton: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#111827",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 700,
  },
  tabButtonActive: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#1d4ed8",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 14,
  },
  h2NoMargin: {
    margin: 0,
    fontSize: 22,
  },
  h2: {
    marginBottom: 16,
    fontSize: 22,
  },
  gridCompactTop: {
    marginBottom: 16,
  },
  formCompact: {
    display: "grid",
    gridTemplateColumns: "1fr 1.3fr 1fr 1fr auto",
    gap: 10,
    alignItems: "center",
  },
  assignmentBar: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  input: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "white",
    outline: "none",
  },
  inputCompact: {
    width: "100%",
    padding: 8,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "white",
    outline: "none",
  },
  inputCompactWide: {
    width: "100%",
    padding: 8,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "white",
    outline: "none",
    marginTop: 8,
  },
  buttonPrimary: {
    padding: "11px 16px",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  buttonSecondary: {
    padding: "11px 16px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  buttonDanger: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  rowButtonsCompact: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  smallPrimaryButton: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  smallSecondaryButton: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  smallDangerButton: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  compactTableWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.4fr 0.8fr 1fr 1.8fr 1fr",
    gap: 12,
    padding: "0 10px 8px 10px",
    color: "#8ea0bb",
    fontSize: 13,
    fontWeight: 700,
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.4fr 0.8fr 1fr 1.8fr 1fr",
    gap: 12,
    alignItems: "center",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: "12px 10px",
    fontSize: 14,
  },
  tableHeaderLists: {
    display: "grid",
    gridTemplateColumns: "1fr 1.7fr 1fr 0.8fr 1fr",
    gap: 12,
    padding: "0 10px 8px 10px",
    color: "#8ea0bb",
    fontSize: 13,
    fontWeight: 700,
  },
  tableRowLists: {
    display: "grid",
    gridTemplateColumns: "1fr 1.7fr 1fr 0.8fr 1fr",
    gap: 12,
    alignItems: "center",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: "12px 10px",
    fontSize: 14,
  },
  tableHeaderAssignments: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1.8fr 0.8fr",
    gap: 12,
    padding: "0 10px 8px 10px",
    color: "#8ea0bb",
    fontSize: 13,
    fontWeight: 700,
  },
  tableRowAssignments: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1.8fr 0.8fr",
    gap: 12,
    alignItems: "center",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: "12px 10px",
    fontSize: 14,
  },
  cellStrong: {
    fontWeight: 700,
  },
  cellEllipsis: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cellListNames: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#dbe5f3",
  },
  badgeActiveMini: {
    display: "inline-block",
    background: "#166534",
    color: "#dcfce7",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  badgeBlockedMini: {
    display: "inline-block",
    background: "#7f1d1d",
    color: "#fee2e2",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  subSectionTitle: {
    fontWeight: 700,
    marginBottom: 8,
  },
  muted: {
    color: "#94a3b8",
  },
  mutedSmall: {
    color: "#94a3b8",
    fontSize: 13,
  },
  assignmentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    padding: 12,
    background: "#111827",
    borderRadius: 14,
  },
  fullRowPassword: {
    gridColumn: "1 / -1",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 760,
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 800,
  },
  modalSubtitle: {
    color: "#9fb0c8",
    marginTop: 4,
  },
  modalSection: {
    marginTop: 16,
  },
  manageBar: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "center",
  },
  remoteFormGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr 1fr 1fr",
    gap: 10,
    alignItems: "center",
  },
  error: {
    color: "#fca5a5",
    marginBottom: 12,
  },
  info: {
    color: "#cbd5e1",
    marginBottom: 12,
  },
};
