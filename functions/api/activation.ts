import { getAssignedActiveLists, getOrCreateDevice, json, type Env, type PagesFunction } from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const payload = await request.json();
    const device = await getOrCreateDevice(env.DB, payload);

    const isPermanent = !!device.is_permanent;
    const isExpired = !isPermanent && device.expires_at && new Date(device.expires_at).getTime() < Date.now();
    const activated = !!device.is_active && !isExpired;
    const lists = activated ? await getAssignedActiveLists(env.DB, device.id) : [];

    return json({
      activated,
      message: activated ? "Dispositivo activado" : "Dispositivo pendiente de activar",
      lists: lists.map((list: any) => ({
        id: list.id,
        alias: list.alias,
        server: list.server,
        username: list.username,
        password: list.password,
      })),
    });
  } catch (error) {
    return json({ activated: false, message: error instanceof Error ? error.message : "Error de activacion" }, 500);
  }
};

