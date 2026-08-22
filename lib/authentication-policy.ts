export function localStaffLoginEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.STAFF_LOCAL_LOGIN_ENABLED === "true") return true;
  if (env.STAFF_LOCAL_LOGIN_ENABLED === "false") return false;
  return env.NODE_ENV !== "production";
}
