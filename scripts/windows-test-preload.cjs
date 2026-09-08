// Some managed Windows runners deny Node's OS-user lookup used by tsx.
// A deterministic test-only identifier avoids that lookup before tsx loads.
if (process.platform === "win32" && typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 0,
  });
}
