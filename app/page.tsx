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
  custom_alias?: string | null;
  platform: string | null;
  app_version: string | null;
  is_active: boolean;
  is_online?: boolean | null;
  current_channel?: string | null;
  current_content_type?: string | null;
  current_updated_at?: string | null;
  last_seen?: string | null;
  heartbeat_at?: string | null;
  playback_state?: string | null;
  app_state?: string | null;
  expires_at?: string | null;
  is_permanent?: boolean | null;
  vpn_config?: string | null;
  vpn_config_updated_at?: string | null;
  reported_lists?: ReportedList[] | null;
  reported_lists_count?: number | null;
  reported_lists_updated_at?: string | null;
};

type ReportedList = {
  id?: string | null;
  name?: string | null;
  alias?: string | null;
  server?: string | null;
  username?: string | null;
  is_active?: boolean | null;
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

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromInputDateTime(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function isDeviceReallyOnline(device: Device) {
  const referenceDate =
    device.heartbeat_at ||
    device.current_updated_at ||
    device.last_seen ||
    null;

  if (!referenceDate) return false;

  const updatedAt = new Date(referenceDate).getTime();
  const now = Date.now();
  const diffSeconds = (now - updatedAt) / 1000;

  return diffSeconds <= 120;
}

function isDeviceExpired(device: Device) {
  if (device.is_permanent) return false;
  if (!device.expires_at) return false;
  return new Date(device.expires_at).getTime() < Date.now();
}

function deviceSortValue(device: Device) {
  return new Date(
    device.heartbeat_at || device.current_updated_at || device.last_seen || 0
  ).getTime();
}

function getWatchingLabel(device: Device) {
  if (!isDeviceReallyOnline(device)) return "Offline";

  if (device.current_channel?.trim()) {
    return device.current_content_type?.trim()
      ? `${device.current_channel} (${device.current_content_type})`
      : device.current_channel;
  }

  if (device.playback_state === "playing") return "Reproduciendo";
  if (device.playback_state === "paused") return "Pausado";
  if (device.playback_state === "buffering") return "Cargando...";
  if (device.app_state === "background") return "En segundo plano";

  return "Sin canal";
}

function getDeviceLabel(device: Device) {
  return (
    device.custom_alias?.trim() ||
    device.display_code?.trim() ||
    device.device_name?.trim() ||
    device.device_code?.trim() ||
    "Sin nombre"
  );
}

function getReportedLists(device?: Device | null): ReportedList[] {
  if (!device?.reported_lists || !Array.isArray(device.reported_lists)) return [];
  return device.reported_lists;
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

  const [activeTab, setActiveTab] = useState<"devices" | "lists" | "assignments" | "vpn">("devices");
  const [showOnlyActiveDevices, setShowOnlyActiveDevices] = useState(false);
  const [showOnlyOnlineDevices, setShowOnlyOnlineDevices] = useState(false);
  const [showOnlyExpiredDevices, setShowOnlyExpiredDevices] = useState(false);
  const [showOnlyActiveLists, setShowOnlyActiveLists] = useState(false);

  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editAlias, setEditAlias] = useState("");
  const [editServer, setEditServer] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [manageDeviceId, setManageDeviceId] = useState<string | null>(null);
  const [manageListId, setManageListId] = useState("");
  const [manageExpiresAt, setManageExpiresAt] = useState("");
  const [manageIsPermanent, setManageIsPermanent] = useState(false);
  const [manageDeviceAlias, setManageDeviceAlias] = useState("");
  const [manageVpnConfig, setManageVpnConfig] = useState("");
  const [vpnEditorDeviceId, setVpnEditorDeviceId] = useState<string | null>(null);
  const [vpnEditorConfig, setVpnEditorConfig] = useState("");

  const [manageEditingListId, setManageEditingListId] = useState<string | null>(null);
  const [manageEditAlias, setManageEditAlias] = useState("");
  const [manageEditServer, setManageEditServer] = useState("");
  const [manageEditUsername, setManageEditUsername] = useState("");
  const [manageEditPassword, setManageEditPassword] = useState("");

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

    return [...devices]
      .filter((d) => {
        const text = [
          d.custom_alias,
          d.display_code,
          d.device_name,
          d.device_code,
          d.platform,
          d.current_channel,
          d.current_content_type,
          d.playback_state,
          d.app_state,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = !q || text.includes(q);
        const matchesActive = !showOnlyActiveDevices || d.is_active;
        const matchesOnline = !showOnlyOnlineDevices || isDeviceReallyOnline(d);
        const matchesExpired = !showOnlyExpiredDevices || isDeviceExpired(d);

        return matchesSearch && matchesActive && matchesOnline && matchesExpired;
      })
      .sort((a, b) => {
        const aOnline = isDeviceReallyOnline(a) ? 1 : 0;
        const bOnline = isDeviceReallyOnline(b) ? 1 : 0;
        if (bOnline !== aOnline) return bOnline - aOnline;

        const aActive = a.is_active ? 1 : 0;
        const bActive = b.is_active ? 1 : 0;
        if (bActive !== aActive) return bActive - aActive;

        return deviceSortValue(b) - deviceSortValue(a);
      });
  }, [devices, search, showOnlyActiveDevices, showOnlyOnlineDevices, showOnlyExpiredDevices]);

  const filteredLists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lists.filter((l) => {
      const matchesActive = !showOnlyActiveLists || l.is_active;
      const text = [l.alias, l.server, l.username].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !q || text.includes(q);
      return matchesActive && matchesSearch;
    });
  }, [lists, showOnlyActiveLists, search]);

  const filteredVpnDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...devices]
      .filter((d) => {
        const text = [
          getDeviceLabel(d),
          d.device_code,
          d.display_code,
          d.device_name,
          d.platform,
          d.vpn_config ? "vpn configurada" : "vpn pendiente",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return !q || text.includes(q);
      })
      .sort((a, b) => {
        const aHasVpn = a.vpn_config?.trim() ? 1 : 0;
        const bHasVpn = b.vpn_config?.trim() ? 1 : 0;
        if (bHasVpn !== aHasVpn) return bHasVpn - aHasVpn;
        return deviceSortValue(b) - deviceSortValue(a);
      });
  }, [devices, search]);

  async function toggleDevice(id: string, active: boolean) {
    const { error } = await supabase.from("devices").update({ is_active: !active }).eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  }

  async function saveDeviceAccess() {
    if (!manageDeviceId) return;

    const payload: {
      expires_at: string | null;
      is_permanent: boolean;
      is_active: boolean;
      custom_alias: string | null;
    } = {
      expires_at: manageIsPermanent ? null : fromInputDateTime(manageExpiresAt),
      is_permanent: manageIsPermanent,
      is_active: manageIsPermanent || !!manageExpiresAt,
      custom_alias: manageDeviceAlias.trim() || null,
    };

    const { error } = await supabase.from("devices").update(payload).eq("id", manageDeviceId);
    if (error) return alert(error.message);
    loadAll();
    alert("Acceso actualizado");
  }

  async function saveDeviceVpnConfig() {
    if (!manageDeviceId) return;
    await saveVpnConfigForDevice(manageDeviceId, manageVpnConfig);
  }

  async function saveVpnEditorConfig() {
    if (!vpnEditorDeviceId) return;
    await saveVpnConfigForDevice(vpnEditorDeviceId, vpnEditorConfig);
    setVpnEditorDeviceId(null);
    setVpnEditorConfig("");
  }

  async function saveVpnConfigForDevice(deviceId: string, rawConfig: string) {
    const config = rawConfig.trim();
    if (config && (!config.includes("[Interface]") || !config.includes("[Peer]"))) {
      return alert("La configuración WireGuard debe incluir [Interface] y [Peer]");
    }

    const { error } = await supabase
      .from("devices")
      .update({
        vpn_config: config || null,
        vpn_config_updated_at: config ? new Date().toISOString() : null,
      })
      .eq("id", deviceId);

    if (error) return alert(error.message);
    loadAll();
    alert(config ? "VPN guardada para este dispositivo" : "VPN eliminada de este dispositivo");
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

  function openListEditor(list: XtreamList) {
    startEditList(list);
    setManageDeviceId(null);
    setActiveTab("lists");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startManageEditList(list: XtreamList) {
    setManageEditingListId(list.id);
    setManageEditAlias(list.alias);
    setManageEditServer(list.server);
    setManageEditUsername(list.username);
    setManageEditPassword(list.password);
  }

  function cancelManageEditList() {
    setManageEditingListId(null);
    setManageEditAlias("");
    setManageEditServer("");
    setManageEditUsername("");
    setManageEditPassword("");
  }

  async function saveManageEditedList(id: string) {
    if (!manageEditAlias || !manageEditServer || !manageEditUsername || !manageEditPassword) {
      return alert("Completa todos los campos para editar la lista");
    }

    const { error } = await supabase
      .from("xtream_lists")
      .update({
        alias: manageEditAlias,
        server: manageEditServer,
        username: manageEditUsername,
        password: manageEditPassword,
      })
      .eq("id", id);

    if (error) return alert(error.message);
    cancelManageEditList();
    loadAll();
  }

  function openManageDevice(device: Device) {
    setManageDeviceId(device.id);
    setManageListId("");
    cancelManageEditList();
    setRemoteAlias("");
    setRemoteServer("");
    setRemoteUsername("");
    setRemotePassword("");
    setManageExpiresAt(toInputDateTime(device.expires_at));
    setManageIsPermanent(!!device.is_permanent);
    setManageDeviceAlias(device.custom_alias || "");
    setManageVpnConfig(device.vpn_config || "");
  }

  function openVpnEditor(device: Device) {
    setVpnEditorDeviceId(device.id);
    setVpnEditorConfig(device.vpn_config || "");
  }

  const totalActiveDevices = devices.filter((d) => d.is_active).length;
  const totalActiveLists = lists.filter((l) => l.is_active).length;
  const totalOnlineDevices = devices.filter((d) => isDeviceReallyOnline(d)).length;
  const totalExpiredDevices = devices.filter((d) => isDeviceExpired(d)).length;
  const totalVpnConfigured = devices.filter((d) => d.vpn_config?.trim()).length;

  const managedDeviceAssignments = manageDeviceId ? getDeviceAssignments(manageDeviceId) : [];
  const availableListsForManagedDevice = manageDeviceId
    ? lists.filter((l) => !managedDeviceAssignments.some((a) => a.xtream_list_id === l.id))
    : lists;

  const managedDevice = manageDeviceId ? getDeviceById(manageDeviceId) : null;
  const managedDeviceReportedLists = getReportedLists(managedDevice);
  const vpnEditorDevice = vpnEditorDeviceId ? getDeviceById(vpnEditorDeviceId) : null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.heroCard}>
          <div>
            <div style={styles.kicker}>Centro de control</div>
            <h1 style={styles.title}>AchoTV Panel</h1>
            <p style={styles.subtitle}>Gestiona dispositivos, listas y VPN Surfshark desde un único sitio.</p>
          </div>
          <button onClick={loadAll} style={styles.refreshButton}>Recargar datos</button>
        </div>

        <div style={styles.statsCompactRow}>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>Dispositivos</span><span style={styles.miniStatValue}>{devices.length}</span></div>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>Activos</span><span style={styles.miniStatValue}>{totalActiveDevices}</span></div>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>Online</span><span style={styles.miniStatValue}>{totalOnlineDevices}</span></div>
          <div style={styles.miniStat}><span style={styles.miniStatLabel}>VPN</span><span style={styles.miniStatValue}>{totalVpnConfigured}</span></div>
        </div>

        <div style={styles.stickyToolbar}>
          <div style={styles.tabBarCompact}>
            <button onClick={() => setActiveTab("devices")} style={activeTab === "devices" ? styles.tabButtonActive : styles.tabButton}>Dispositivos</button>
            <button onClick={() => setActiveTab("lists")} style={activeTab === "lists" ? styles.tabButtonActive : styles.tabButton}>Listas</button>
            <button onClick={() => setActiveTab("assignments")} style={activeTab === "assignments" ? styles.tabButtonActive : styles.tabButton}>Asignaciones</button>
            <button onClick={() => setActiveTab("vpn")} style={activeTab === "vpn" ? styles.tabButtonActive : styles.tabButton}>VPN</button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "devices"
                ? "Buscar dispositivo"
                : activeTab === "vpn"
                  ? "Buscar VPN o dispositivo"
                  : "Buscar lista"
            }
            style={styles.inputCompactTop}
          />
        </div>

        {loading && <p style={styles.info}>Cargando...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {activeTab === "devices" && (
          <div style={styles.stackList}>
            <div style={styles.filtersWrap}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOnlyActiveDevices}
                  onChange={(e) => setShowOnlyActiveDevices(e.target.checked)}
                />
                Solo activos
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOnlyOnlineDevices}
                  onChange={(e) => setShowOnlyOnlineDevices(e.target.checked)}
                />
                Solo online
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOnlyExpiredDevices}
                  onChange={(e) => setShowOnlyExpiredDevices(e.target.checked)}
                />
                Solo caducados
              </label>
            </div>

            {filteredDevices.map((device) => {
              const deviceAssignments = getDeviceAssignments(device.id);
              return (
                <div key={device.id} style={styles.mobileCard}>
                  <div style={styles.mobileCardTop}>
                    <div>
                      <div style={styles.cardTitle}>{getDeviceLabel(device)}</div>
                      <div style={styles.cardSub}>
                        Código: {device.display_code || device.device_code || "-"}
                      </div>
                      <div style={styles.cardSub}>{device.device_name || "Sin nombre"}</div>
                    </div>
                    <div style={styles.badgeColumn}>
                      <span style={device.is_active ? styles.badgeActiveMini : styles.badgeBlockedMini}>
                        {device.is_active ? "Activo" : "Bloq."}
                      </span>
                      <span style={isDeviceReallyOnline(device) ? styles.badgeOnline : styles.badgeOffline}>
                        {isDeviceReallyOnline(device) ? "Online" : "Offline"}
                      </span>
                      {device.is_permanent ? (
                        <span style={styles.badgePermanent}>Permanente</span>
                      ) : isDeviceExpired(device) ? (
                        <span style={styles.badgeExpired}>Caducado</span>
                      ) : device.expires_at ? (
                        <span style={styles.badgeExpiry}>Con fecha</span>
                      ) : null}
                    </div>
                  </div>

                  <div style={styles.infoGridCompact}>
                    <div>
                      <span style={styles.labelMini}>Viendo:</span>{" "}
                      {getWatchingLabel(device)}
                    </div>
                    <div>
                      <span style={styles.labelMini}>Última:</span>{" "}
                      {formatDate(device.heartbeat_at || device.current_updated_at || device.last_seen)}
                    </div>
                    <div>
                      <span style={styles.labelMini}>Caduca:</span>{" "}
                      {device.is_permanent ? "Nunca" : formatDate(device.expires_at)}
                    </div>
                    <div>
                      <span style={styles.labelMini}>Listas:</span>{" "}
                      {deviceAssignments.length === 0
                        ? "Sin listas"
                        : deviceAssignments
                            .map((a) => getList(a.xtream_list_id)?.alias || "Sin alias")
                            .join(", ")}
                    </div>
                  </div>

                  <div style={styles.rowButtonsCompact}>
                    <button onClick={() => toggleDevice(device.id, device.is_active)} style={styles.smallPrimaryButton}>
                      {device.is_active ? "Off" : "On"}
                    </button>
                    <button onClick={() => openManageDevice(device)} style={styles.smallSecondaryButton}>Nueva</button>
                    <button onClick={() => openManageDevice(device)} style={styles.smallSecondaryButton}>Gestionar</button>
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
                <span style={styles.helperMini}>Pulsa Editar y la lista subirá arriba automáticamente.</span>
              </label>
            </div>

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

            {[...filteredLists]
              .sort((a, b) => {
                if (a.id === editingListId) return -1;
                if (b.id === editingListId) return 1;
                return 0;
              })
              .map((list) => (
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
                  <option key={d.id} value={d.id}>{getDeviceLabel(d)}</option>
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
                    <div><span style={styles.labelMini}>Disp.:</span> {device ? getDeviceLabel(device) : "-"}</div>
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

        {activeTab === "vpn" && (
          <div style={styles.stackList}>
            <div style={styles.sectionIntro}>
              <div>
                <div style={styles.sectionTitle}>VPN por dispositivo</div>
                <div style={styles.sectionText}>
                  Cada Fire Stick debe tener una configuración WireGuard distinta para evitar cortes cuando usas varios a la vez.
                </div>
              </div>
              <div style={styles.vpnSummaryPill}>
                {totalVpnConfigured}/{devices.length} configurados
              </div>
            </div>

            {filteredVpnDevices.map((device) => {
              const hasVpn = !!device.vpn_config?.trim();
              return (
                <div key={device.id} style={hasVpn ? styles.vpnCardReady : styles.vpnCardPending}>
                  <div style={styles.mobileCardTop}>
                    <div>
                      <div style={styles.cardTitle}>{getDeviceLabel(device)}</div>
                      <div style={styles.cardSub}>
                        Código: {device.display_code || device.device_code || "-"}
                      </div>
                    </div>
                    <div style={styles.badgeColumn}>
                      <span style={hasVpn ? styles.badgeOnline : styles.badgeExpired}>
                        {hasVpn ? "VPN lista" : "Sin VPN"}
                      </span>
                      <span style={isDeviceReallyOnline(device) ? styles.badgeOnline : styles.badgeOffline}>
                        {isDeviceReallyOnline(device) ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.infoGridCompact}>
                    <div>
                      <span style={styles.labelMini}>Actualizada:</span>{" "}
                      {formatDate(device.vpn_config_updated_at)}
                    </div>
                    <div>
                      <span style={styles.labelMini}>Estado app:</span>{" "}
                      {getWatchingLabel(device)}
                    </div>
                    <div>
                      <span style={styles.labelMini}>Recomendación:</span>{" "}
                      {hasVpn ? "Usar esta configuración solo en este dispositivo." : "Pega aquí una configuración única de Surfshark."}
                    </div>
                  </div>

                  <div style={styles.rowButtonsCompact}>
                    <button onClick={() => openVpnEditor(device)} style={styles.smallPrimaryButton}>
                      {hasVpn ? "Editar VPN" : "Añadir VPN"}
                    </button>
                    <button onClick={() => openManageDevice(device)} style={styles.smallSecondaryButton}>
                      Gestionar dispositivo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {vpnEditorDeviceId && (
          <div
            style={styles.modalBackdrop}
            onClick={() => {
              setVpnEditorDeviceId(null);
              setVpnEditorConfig("");
            }}
          >
            <div style={styles.vpnModalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeaderCompact}>
                <div>
                  <div style={styles.modalTitle}>Editar VPN Surfshark</div>
                  <div style={styles.modalSubtitle}>
                    {vpnEditorDevice ? getDeviceLabel(vpnEditorDevice) : vpnEditorDeviceId}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setVpnEditorDeviceId(null);
                    setVpnEditorConfig("");
                  }}
                  style={styles.smallDangerButton}
                >
                  Cerrar
                </button>
              </div>

              <div style={styles.vpnNotice}>
                Pega una configuración WireGuard única para este Fire Stick. Si dos dispositivos usan la misma clave, uno puede cortar al otro.
              </div>

              <textarea
                value={vpnEditorConfig}
                onChange={(e) => setVpnEditorConfig(e.target.value)}
                placeholder="Pega aquí el archivo .conf de Surfshark para este dispositivo"
                style={styles.vpnTextarea}
              />

              <div style={styles.rowButtonsCompact}>
                <button onClick={saveVpnEditorConfig} style={styles.buttonPrimary}>Guardar VPN</button>
                <button onClick={() => setVpnEditorConfig("")} style={styles.smallSecondaryButton}>Vaciar texto</button>
                <button
                  onClick={async () => {
                    if (!vpnEditorDeviceId) return;
                    if (!window.confirm("¿Eliminar la VPN de este dispositivo?")) return;
                    await saveVpnConfigForDevice(vpnEditorDeviceId, "");
                    setVpnEditorDeviceId(null);
                    setVpnEditorConfig("");
                  }}
                  style={styles.smallDangerButton}
                >
                  Eliminar VPN
                </button>
              </div>
            </div>
          </div>
        )}

        {manageDeviceId && (
          <div style={styles.modalBackdrop} onClick={() => setManageDeviceId(null)}>
            <div style={styles.modalCardMobile} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeaderCompact}>
                <div>
                  <div style={styles.modalTitle}>Gestionar listas</div>
                  <div style={styles.modalSubtitle}>
                    {managedDevice ? getDeviceLabel(managedDevice) : manageDeviceId}
                  </div>
                </div>
                <button onClick={() => setManageDeviceId(null)} style={styles.smallDangerButton}>Cerrar</button>
              </div>

              <div style={styles.modalSection}>
  <div style={styles.subSectionTitle}>Alias del dispositivo</div>
  <div style={styles.formMobileStack}>
    <input
      value={manageDeviceAlias}
      onChange={(e) => setManageDeviceAlias(e.target.value)}
      placeholder="Alias del dispositivo"
      style={styles.input}
    />
    <button
      onClick={async () => {
        if (!manageDeviceId) return;

        const { error } = await supabase
          .from("devices")
          .update({
            custom_alias: manageDeviceAlias.trim() || null,
          })
          .eq("id", manageDeviceId);

        if (error) return alert(error.message);

        loadAll();
        alert("Alias guardado");
      }}
      style={styles.buttonPrimary}
    >
      Guardar alias
    </button>
  </div>
</div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>Acceso</div>
                <div style={styles.formMobileStack}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={manageIsPermanent}
                      onChange={(e) => setManageIsPermanent(e.target.checked)}
                    />
                    Activación permanente
                  </label>
                  {!manageIsPermanent && (
                    <input
                      type="datetime-local"
                      value={manageExpiresAt}
                      onChange={(e) => setManageExpiresAt(e.target.value)}
                      style={styles.input}
                    />
                  )}
                  <button onClick={saveDeviceAccess} style={styles.buttonPrimary}>Guardar acceso</button>
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>VPN Surfshark del dispositivo</div>
                <div style={styles.formMobileStack}>
                  <textarea
                    value={manageVpnConfig}
                    onChange={(e) => setManageVpnConfig(e.target.value)}
                    placeholder="Pega aqui el .conf WireGuard unico de este Fire Stick"
                    style={{ ...styles.input, minHeight: 160, resize: "vertical", fontFamily: "monospace" }}
                  />
                  <div style={styles.helperMini}>
                    Usa una configuracion distinta por dispositivo para evitar cortes entre Fire Sticks.
                  </div>
                  <div style={styles.rowButtonsCompact}>
                    <button onClick={saveDeviceVpnConfig} style={styles.smallPrimaryButton}>Guardar VPN</button>
                    <button
                      onClick={() => {
                        setManageVpnConfig("");
                      }}
                      style={styles.smallSecondaryButton}
                    >
                      Vaciar
                    </button>
                  </div>
                </div>
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
                      if (!list) return null;

                      const isEditingThis = manageEditingListId === list.id;

                      return (
                        <div key={a.id} style={styles.mobileCardMini}>
                          {isEditingThis ? (
                            <div style={styles.formMobileStack}>
                              <input
                                value={manageEditAlias}
                                onChange={(e) => setManageEditAlias(e.target.value)}
                                placeholder="Alias"
                                style={styles.input}
                              />
                              <input
                                value={manageEditServer}
                                onChange={(e) => setManageEditServer(e.target.value)}
                                placeholder="Servidor"
                                style={styles.input}
                              />
                              <div style={styles.doubleRow}>
                                <input
                                  value={manageEditUsername}
                                  onChange={(e) => setManageEditUsername(e.target.value)}
                                  placeholder="Usuario"
                                  style={styles.input}
                                />
                                <input
                                  value={manageEditPassword}
                                  onChange={(e) => setManageEditPassword(e.target.value)}
                                  placeholder="Contraseña"
                                  style={styles.input}
                                />
                              </div>
                              <div style={styles.rowButtonsCompact}>
                                <button onClick={() => saveManageEditedList(list.id)} style={styles.smallPrimaryButton}>Guardar</button>
                                <button onClick={cancelManageEditList} style={styles.smallSecondaryButton}>Cancelar</button>
                                <button onClick={() => deleteAssignment(a.id)} style={styles.smallDangerButton}>Quitar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <div style={styles.cardTitleSmall}>{list.alias || "Sin alias"}</div>
                                <div style={styles.cardSubSmall}>{list.server || "-"}</div>
                              </div>
                              <div style={styles.rowButtonsCompact}>
                                <button onClick={() => startManageEditList(list)} style={styles.smallSecondaryButton}>Editar</button>
                                <button onClick={() => deleteAssignment(a.id)} style={styles.smallDangerButton}>Quitar</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={styles.modalSection}>
                <div style={styles.subSectionTitle}>Listas reportadas por la app</div>
                <div style={styles.formMobileStack}>
                  <div style={styles.helperMini}>
                    Se actualizan cuando el usuario añade, cambia o borra listas dentro de AchoTV.
                  </div>
                  <div style={styles.muted}>
                    Última sincronización: {formatDate(managedDevice?.reported_lists_updated_at)}
                  </div>
                  {managedDeviceReportedLists.length === 0 ? (
                    <div style={styles.muted}>La app todavía no ha enviado listas a este dispositivo.</div>
                  ) : (
                    <div style={styles.listWrap}>
                      {managedDeviceReportedLists.map((list, index) => (
                        <div key={`${list.id || list.server || "list"}-${index}`} style={styles.mobileCardMini}>
                          <div>
                            <div style={styles.cardTitleSmall}>
                              {list.alias?.trim() || list.name?.trim() || "Sin alias"}
                            </div>
                            <div style={styles.cardSubSmall}>{list.server || "-"}</div>
                            <div style={styles.cardSubSmall}>{list.username || "-"}</div>
                          </div>
                          <div style={styles.rowButtonsCompact}>
                            <span style={list.is_active ? styles.badgeActiveMini : styles.badgeOffline}>
                              {list.is_active ? "Activa en app" : "Guardada"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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
    background: "linear-gradient(180deg, #06101d 0%, #0b1220 45%, #0f172a 100%)",
    color: "#ffffff",
    padding: 16,
    fontFamily: "Inter, Arial, sans-serif",
  },

  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },

  heroCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
    padding: 18,
    borderRadius: 24,
    border: "1px solid rgba(59,130,246,0.26)",
    background:
      "radial-gradient(circle at 18% 10%, rgba(37,99,235,0.35) 0, transparent 32%), linear-gradient(135deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))",
    boxShadow: "0 18px 48px rgba(0,0,0,0.32)",
  },

  kicker: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.4,
    marginBottom: 4,
    textTransform: "uppercase",
  },

  headerCompact: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    padding: "6px 2px",
  },

  title: {
    fontSize: 30,
    fontWeight: 800,
    margin: 0,
    letterSpacing: -0.5,
  },

  subtitle: {
    color: "#94a3b8",
    margin: "4px 0 0 0",
    fontSize: 14,
  },

  refreshButton: {
    padding: "12px 15px",
    borderRadius: 14,
    border: "1px solid rgba(147,197,253,0.35)",
    background: "rgba(15,23,42,0.78)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  statsCompactRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 14,
  },

  miniStat: {
    background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
    borderRadius: 16,
    padding: "14px 10px",
    border: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  },

  miniStatLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
  },

  miniStatValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "#ffffff",
  },

  stickyToolbar: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: "rgba(6,16,29,0.88)",
    backdropFilter: "blur(10px)",
    padding: "8px 0 10px 0",
    marginBottom: 14,
  },

  tabBarCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginBottom: 10,
  },

  tabButton: {
    padding: "12px 10px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#111827",
    color: "#cbd5e1",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    transition: "all 0.2s ease",
  },

  tabButtonActive: {
    padding: "12px 10px",
    borderRadius: 12,
    border: "1px solid #3b82f6",
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    boxShadow: "0 8px 20px rgba(37,99,235,0.35)",
  },

  inputCompactTop: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "white",
    outline: "none",
    fontSize: 14,
  },

  stackList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  sectionIntro: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(37,99,235,0.08))",
    border: "1px solid rgba(59,130,246,0.22)",
    borderRadius: 18,
    padding: 14,
  },

  sectionTitle: {
    fontWeight: 900,
    fontSize: 17,
    color: "#ffffff",
  },

  sectionText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.4,
    marginTop: 4,
  },

  vpnSummaryPill: {
    padding: "9px 12px",
    borderRadius: 999,
    background: "#0f766e",
    color: "#ccfbf1",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  mobileCard: {
    background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
    border: "1px solid #1f2937",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },

  vpnCardReady: {
    background: "linear-gradient(180deg, rgba(6,78,59,0.72) 0%, #0f172a 100%)",
    border: "1px solid rgba(16,185,129,0.34)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },

  vpnCardPending: {
    background: "linear-gradient(180deg, rgba(127,29,29,0.42) 0%, #0f172a 100%)",
    border: "1px solid rgba(248,113,113,0.28)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },

  mobileCardMini: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  mobileCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  badgeColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },

  cardTitle: {
    fontWeight: 800,
    fontSize: 18,
    lineHeight: 1.1,
    color: "#ffffff",
  },

  cardSub: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 1.35,
  },

  cardTitleSmall: {
    fontWeight: 700,
    fontSize: 15,
    color: "#ffffff",
  },

  cardSubSmall: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 3,
  },

  infoGridCompact: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    color: "#e5edf9",
    lineHeight: 1.4,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 10,
  },

  labelMini: {
    color: "#93c5fd",
    fontWeight: 700,
  },

  filtersWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 4,
  },

  filterRowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
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
    gap: 10,
    background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
    border: "1px solid #1f2937",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
  },

  doubleRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  input: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "white",
    outline: "none",
    fontSize: 14,
  },

  buttonPrimary: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    boxShadow: "0 8px 20px rgba(37,99,235,0.35)",
  },

  rowButtonsCompact: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  smallPrimaryButton: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },

  smallSecondaryButton: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },

  smallDangerButton: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },

  badgeActiveMini: {
    display: "inline-block",
    background: "#166534",
    color: "#dcfce7",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },

  badgeBlockedMini: {
    display: "inline-block",
    background: "#7f1d1d",
    color: "#fee2e2",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },

  badgeOnline: {
    display: "inline-block",
    background: "#065f46",
    color: "#d1fae5",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },

  badgeOffline: {
    display: "inline-block",
    background: "#374151",
    color: "#e5e7eb",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },

  badgePermanent: {
    display: "inline-block",
    background: "#1d4ed8",
    color: "#dbeafe",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },

  badgeExpired: {
    display: "inline-block",
    background: "#b91c1c",
    color: "#fee2e2",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },

  badgeExpiry: {
    display: "inline-block",
    background: "#7c3aed",
    color: "#ede9fe",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },

  helperMini: {
    color: "#93c5fd",
    fontSize: 12,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.66)",
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
    background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    border: "1px solid #1f2937",
    boxShadow: "0 -12px 30px rgba(0,0,0,0.35)",
  },

  vpnModalCard: {
    width: "min(760px, calc(100% - 24px))",
    maxHeight: "90vh",
    overflowY: "auto",
    background:
      "radial-gradient(circle at 20% 0%, rgba(14,165,233,0.18) 0, transparent 30%), linear-gradient(180deg, #0f172a 0%, #111827 100%)",
    borderRadius: 22,
    padding: 16,
    border: "1px solid rgba(59,130,246,0.28)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.48)",
  },

  vpnNotice: {
    color: "#bfdbfe",
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(96,165,250,0.22)",
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.45,
    marginBottom: 12,
  },

  vpnTextarea: {
    width: "100%",
    minHeight: 280,
    padding: 13,
    borderRadius: 14,
    border: "1px solid #334155",
    background: "#020617",
    color: "#e5edf9",
    outline: "none",
    fontSize: 13,
    lineHeight: 1.45,
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    resize: "vertical",
    marginBottom: 12,
  },

  modalHeaderCompact: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 19,
    fontWeight: 800,
  },

  modalSubtitle: {
    color: "#94a3b8",
    marginTop: 4,
    fontSize: 12,
  },

  modalSection: {
    marginTop: 14,
    paddingTop: 6,
  },

  subSectionTitle: {
    fontWeight: 800,
    marginBottom: 8,
    fontSize: 14,
    color: "#ffffff",
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
