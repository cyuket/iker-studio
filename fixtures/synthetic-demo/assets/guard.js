// Sends visitors without a demo session to the log-in page. The flag lives in
// sessionStorage, so every new browser tab starts signed out.
if (sessionStorage.getItem("demo-console-session") !== "1") {
  location.replace("/login");
}
