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
  is_online?: boolean | null;
  current_channel?: string | null;
  current_content_type?: string | null;
  current_updated_at?: string | null;
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

function isDeviceReallyOnline(device: Device) {
  if (!device.is_online || !device.current_updated_at) return false;
  const updatedAt = new Date(device.current_updated_at).getTime();
  const now = Date.now();
  const diffSeconds = (now - updatedAt) / 1000;
  return diffSeconds <= 40;
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

  const [, setNowTick] = useState(0);

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

  useEffect(() => {
    const channel = supabase
      .channel("acho-realtime-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "xtream_lists" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "device_list_assignments" }, () => loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick((v) => v + 1);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();

    return devices.filter((d) => {
      const text = [
        d.display_code,
        d.device_name,
        d.device_code,
        d.platform,
        d.current_channel,
        d.current_content_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);
      const matchesActive = !showOnlyActiveDevices || d.is_active;

      return matchesSearch && matchesActive;
    });
  }, [devices, search, showOnlyActiveDevices]);

  const filteredLists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lists.filter((l) => {
      const matchesActive = !showOnlyActiveLists || l.is_active;
      const text = [l.alias, l.server, l.username].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !q || text.includes(q);
      return matchesActive && matchesSearch;
    });
  }, [lists, showOnlyActiveLists, search]);

  async function toggleDevice(id: string, active: boolean) {
    const { error } = await supabase.from("devices").update({ is_active: !active }).eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!alias || !server || !username || !password) return alert("Completa todos los campos de la lista");

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
    if (!selectedDeviceId || !selectedListId) return alert("Selecciona dispositivo y lista");

    const exists = assignments.some((a) => a.device_id === selectedDeviceId && a.xtream_list_id === selectedListId);
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

    const exists = assignments.some((a) => a.device_id === deviceId && a.xtream_list_id === listId);
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
  const totalOnlineDevices = devices.filter((d) => isDeviceReallyOnline(d)).length;

  const managedDeviceAssignments = manageDeviceId ? getDeviceAssignments(manageDeviceId) : [];
  const availableListsForManagedDevice = manageDeviceId
    ? lists.filter((l) => !managedDeviceAssignments.some((a) => a.xtream_list_id === l.id))
    : lists;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerCompact}>
          <div>
            <h1 style={styles.title}>AchoTV Panel</h1>
            <p style={styles.subtitle}>Control rápido desde móvil</p>
          </div>
          <button onClick={loadAll} style={styles.smallSecondaryButton}>Recargar</button>
        </div>

        <div style={styles.statsCompactRow}>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>Disp.</span><span style={styles.miniStatValue}>{devices.length}</span></div>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>Activos</span><span style={styles.miniStatValue}>{totalActiveDevices}</span></div>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>Online</span><span style={styles.miniStatValue}>{totalOnlineDevices}</span></div>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>Listas</span><span style={styles.miniStatValue}>{totalActiveLists}</span></div>
        </div>

        <div style={styles.stickyToolbar}>
          <div style={styles.tabBarCompact}>
            <button onClick={() => setActiveTab("devices")} style={activeTab === "devices" ? styles.tabButtonActive : styles.tabButton}>Disp.</button>
            <button onClick={() => setActiveTab("lists")} style={activeTab === "lists" ? styles.tabButtonActive : styles.tabButton}>Listas</button>
            <button onClick={() => setActiveTab("assignments")} style={activeTab === "assignments" ? styles.tabButtonActive : styles.tabButton}>Asig.</button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "devices" ? "Buscar dispositivo" : "Buscar lista"}
            style={styles.inputCompactTop}
          />
        </div>

        {loading && <p style={styles.info}>Cargando...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {activeTab === "devices" && (
          <div style={styles.stackList}>
            <div style={styles.filterRow}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOnlyActiveDevices}
                  onChange={(e) => setShowOnlyActiveDevices(e.target.checked)}
                />
                Solo activos
              </label>
            </div>

            {filteredDevices.map((device) => {
              const deviceAssignments = getDeviceAssignments(device.id);
              return (
                <div key={device.id} style={styles.mobileCard}>
                  <div style={styles.mobileCardTop}>
                    <div>
                      <div style={styles.cardTitle}>{device.display_code || "-"}</div>
                      <div style={styles.cardSub}>{device.device_name || "Sin nombre"}</div>
                    </div>
                    <div style={styles.badgeColumn}>
                      <span style={device.is_active ? styles.badgeActiveMini : styles.badgeBlockedMini}>
                        {device.is_active ? "Activo" : "Bloq."}
                      </span>
                      <span style={isDeviceReallyOnline(device) ? styles.badgeOnline : styles.badgeOffline}>
                        {isDeviceReallyOnline(device) ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.infoGridCompact}>
                    <div><span style={styles.labelMini}>Viendo:</span> {device.current_channel ? `${device.current_channel}${device.current_content_type ? ` (${device.current_content_type})` : ""}` : "-"}</div>
                    <div><span style={styles.labelMini}>Última:</span> {formatDate(device.current_updated_at || device.last_seen)}</div>
                    <div><span style={styles.labelMini}>Listas:</span> {deviceAssignments.length === 0 ? "Sin listas" : deviceAssignments.map((a) => getList(a.xtream_list_id)?.alias || "Sin alias").join(", ")}</div>
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
                    <button
                      onClick={() => {
                        setManageDeviceId(device.id);
                        setManageListId("");
                      }}
                      style={styles.smallSecondaryButton}
                    >
                      Gestionar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "lists" && (
          <div style={styles.stackList}>
            <div style={styles.filterRowBetween}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOnlyActiveLists}
                  onChange={(e) => setShowOnlyActiveLists(e.target.checked)}
                />
                Solo activas
              </label>
            </div>

            <form onSubmit={createList} style={styles.formMobileStack}>
              <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias" style={styles.input} />
              <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="Servidor" style={styles.input} />
              <div style={styles.doubleRow}>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" style={styles.input} />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" style={styles.input} />
              </div>
              <button type="submit" style={styles.buttonPrimary}>Guardar lista</button>
            </form>

            {filteredLists.map((list) => (
              <div key={list.id} style={styles.mobileCard}>
                {editingListId === list.id ? (
                  <>
                    <input value={editAlias} onChange={(e) => setEditAlias(e.target.value)} style={styles.input} placeholder="Alias" />
                    <input value={editServer} onChange={(e) => setEditServer(e.target.value)} style={styles.input} placeholder="Servidor" />
                    <div style={styles.doubleRow}>
                      <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={styles.input} placeholder="Usuario" />
                      <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} style={styles.input} placeholder="Contraseña" />
                    </div>
                    <div style={styles.rowButtonsCompact}>
                      <button onClick={() => saveEditedList(list.id)} style={styles.smallPrimaryButton}>Guardar</button>
                      <button onClick={cancelEditList} style={styles.smallSecondaryButton}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.mobileCardTop}>
                      <div>
                        <div style={styles.cardTitle}>{list.alias}</div>
                        <div style={styles.cardSub}>{list.server}</div>
                      </div>
                      <span style={list.is_active ? styles.badgeActiveMini : styles.badgeBlockedMini}>
                        {list.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <div style={styles.infoGridCompact}>
                      <div><span style={styles.labelMini}>Usuario:</span> {list.username}</div>
                      <div><span style={styles.labelMini}>Creada:</span> {formatDate(list.created_at)}</div>
                    </div>
                    <div style={styles.rowButtonsCompact}>
                      <button onClick={() => startEditList(list)} style={styles.smallSecondaryButton}>Editar</button>
                      <button onClick={() => toggleList(list.id, list.is_active)} style={styles.smallSecondaryButton}>{list.is_active ? "Off" : "On"}</button>
                      <button onClick={() => deleteList(list.id)} style={styles.smallDangerButton}>Eliminar</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "assignments" && (
          <div style={styles.stackList}>
            <form onSubmit={assignList} style={styles.formMobileStack}>
              <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} style={styles.input}>
                <option value="">Selecciona dispositivo</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.display_code || d.device_name || d.id}</option>
                ))}
              </select>

              <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} style={styles.input}>
                <option value="">Selecciona lista</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.alias}</option>
                ))}
              </select>

              <button type="submit" style={styles.buttonPrimary}>Asignar</button>
            </form>

            {assignments.map((a) => {
              const device = getDeviceById(a.device_id);
              const list = getList(a.xtream_list_id);
              return (
                <div key={a.id} style={styles.mobileCard}>
                  <div style={styles.infoGridCompact}>
                    <div><span style={styles.labelMini}>Disp.:</span> {device?.display_code || device?.device_name || "-"}</div>
                    <div><span style={styles.labelMini}>Lista:</span> {list?.alias || "Sin alias"}</div>
                    <div><span style={styles.labelMini}>Servidor:</span> {list?.server || "-"}</div>
                  </div>
                  <div style={styles.rowButtonsCompact}>
                    <button onClick={() => deleteAssignment(a.id)} style={styles.smallDangerButton}>Quitar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {manageDeviceId && (
          <div style={styles.modalBackdrop} onClick={() => setManageDeviceId(null)}>
            <div style={styles.modalCardMobile} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeaderCompact}>
                <div>
                  <div style={styles.modalTitle}>Gestionar listas</div>
                  <div style={styles.modalSubtitle}>{getDeviceById(manageDeviceId)?.display_code || getDeviceById(manageDeviceId)?.device_name || manageDeviceId}</div>
                </div>
                <button onClick={() => setManageDeviceId(null)} style={styles.smallDangerButton}>Cerrar</button>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>Lista nueva</div>
                <div style={styles.formMobileStack}>
                  <input value={remoteAlias} onChange={(e) => setRemoteAlias(e.target.value)} placeholder="Alias" style={styles.input} />
                  <input value={remoteServer} onChange={(e) => setRemoteServer(e.target.value)} placeholder="Servidor" style={styles.input} />
                  <div style={styles.doubleRow}>
                    <input value={remoteUsername} onChange={(e) => setRemoteUsername(e.target.value)} placeholder="Usuario" style={styles.input} />
                    <input value={remotePassword} onChange={(e) => setRemotePassword(e.target.value)} placeholder="Contraseña" style={styles.input} />
                  </div>
                  <button onClick={() => addRemoteListToDevice(manageDeviceId)} style={styles.buttonPrimary}>Crear y asignar</button>
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>Añadir existente</div>
                <div style={styles.formMobileStack}>
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
                        <div key={a.id} style={styles.mobileCardMini}>
                          <div>
                            <div style={styles.cardTitleSmall}>{list?.alias || "Sin alias"}</div>
                            <div style={styles.cardSubSmall}>{list?.server || "-"}</div>
                          </div>
                          <div style={styles.rowButtonsCompact}>
                            {list && <button onClick={() => startEditList(list)} style={styles.smallSecondaryButton}>Editar</button>}
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
    padding: 10,
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
  },
  headerCompact: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
  },
  subtitle: {
    color: "#9fb0c8",
    margin: "3px 0 0 0",
    fontSize: 13,
  },
  statsCompactRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 10,
  },
  miniStat: {
    background: "#111827",
    borderRadius: 12,
    padding: "10px 8px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "center",
  },
  miniStatLabel: {
    fontSize: 11,
    color: "#8ea0bb",
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: 800,
  },
  stickyToolbar: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: "rgba(8,17,32,0.95)",
    backdropFilter: "blur(6px)",
    paddingBottom: 8,
    marginBottom: 10,
  },
  tabBarCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 6,
    marginBottom: 8,
  },
  tabButton: {
    padding: "10px 8px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#111827",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  tabButtonActive: {
    padding: "10px 8px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#1d4ed8",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  inputCompactTop: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "white",
    outline: "none",
    fontSize: 14,
  },
  stackList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  mobileCard: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  mobileCardMini: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  mobileCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  badgeColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
  cardTitle: {
    fontWeight: 800,
    fontSize: 17,
    lineHeight: 1.1,
  },
  cardSub: {
    fontSize: 12,
    color: "#9fb0c8",
    marginTop: 2,
    lineHeight: 1.25,
  },
  cardTitleSmall: {
    fontWeight: 700,
    fontSize: 14,
  },
  cardSubSmall: {
    fontSize: 12,
    color: "#9fb0c8",
    marginTop: 2,
  },
  infoGridCompact: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    color: "#e5edf9",
    lineHeight: 1.3,
  },
  labelMini: {
    color: "#8ea0bb",
    fontWeight: 700,
  },
  filterRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  filterRowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 13,
  },
  formMobileStack: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: 10,
  },
  doubleRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "white",
    outline: "none",
    fontSize: 14,
  },
  buttonPrimary: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  buttonSecondary: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  rowButtonsCompact: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  smallPrimaryButton: {
    padding: "8px 10px",
    borderRadius: 9,
    border: "none",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  smallSecondaryButton: {
    padding: "8px 10px",
    borderRadius: 9,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  smallDangerButton: {
    padding: "8px 10px",
    borderRadius: 9,
    border: "none",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  badgeActiveMini: {
    display: "inline-block",
    background: "#166534",
    color: "#dcfce7",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  badgeBlockedMini: {
    display: "inline-block",
    background: "#7f1d1d",
    color: "#fee2e2",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  badgeOnline: {
    display: "inline-block",
    background: "#065f46",
    color: "#d1fae5",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  badgeOffline: {
    display: "inline-block",
    background: "#374151",
    color: "#e5e7eb",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.62)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 0,
    zIndex: 30,
  },
  modalCardMobile: {
    width: "100%",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#0f172a",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 12,
    border: "1px solid #1f2937",
  },
  modalHeaderCompact: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
  },
  modalSubtitle: {
    color: "#9fb0c8",
    marginTop: 3,
    fontSize: 12,
  },
  modalSection: {
    marginTop: 12,
  },
  subSectionTitle: {
    fontWeight: 700,
    marginBottom: 8,
    fontSize: 14,
  },
  listWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 13,
  },
  assignmentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: 10,
    background: "#111827",
    borderRadius: 12,
  },
  compactTableWrap: { display: "none" },
  tableHeaderWide: { display: "none" },
  tableRowWide: { display: "none" },
  tableHeaderLists: { display: "none" },
  tableRowLists: { display: "none" },
  tableHeaderAssignments: { display: "none" },
  tableRowAssignments: { display: "none" },
  card: { display: "none" },
  h2NoMargin: { margin: 0 },
  gridCompactTop: { marginBottom: 0 },
  formCompact: { display: "none" },
  assignmentBar: { display: "none" },
  inputCompact: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "white",
    outline: "none",
  },
  inputCompactWide: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "white",
    outline: "none",
  },
  cellStrong: { fontWeight: 700 },
  cellEllipsis: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cellListNames: { color: "#dbe5f3" },
  error: {
    color: "#fca5a5",
    margin: "4px 0 10px 0",
    fontSize: 13,
  },
  info: {
    color: "#cbd5e1",
    margin: "4px 0 10px 0",
    fontSize: 13,
  },
};
