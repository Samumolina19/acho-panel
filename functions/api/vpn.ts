import { json, type Env, type PagesFunction } from "./_shared";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const deviceCode = url.searchParams.get("device_code")?.trim();
    if (!deviceCode) return json({ vpn_config: "" });

    const row = await env.DB
      .prepare("select vpn_config from devices where device_code = ? limit 1")
      .bind(deviceCode)
      .first();

    return json({ vpn_config: row?.vpn_config?.trim() || "" });
  } catch (error) {
    return json({ vpn_config: "", error: error instanceof Error ? error.message : "Error descargando VPN" }, 500);
  }
};
