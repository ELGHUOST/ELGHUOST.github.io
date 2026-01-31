
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

function setMsg(text, type) {
  const msg = document.getElementById("msg");
  msg.textContent = text || "";
  msg.className = "msg" + (type ? ` ${type}` : "");
}

function showLoading(on) {
  const loading = document.getElementById("loading");
  loading.hidden = !on;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setMsg("");

    const u = document.getElementById("username").value.trim();
    const p = document.getElementById("password").value;

    showLoading(true);

    // petit délai pour l'effet "validation"
    setTimeout(() => {
      if (u === ADMIN_USER && p === ADMIN_PASS) {
        localStorage.setItem("raha_auth", "1");
        setMsg("Accès autorisé. Redirection…", "ok");
        window.location.href = "index.html";
      } else {
        showLoading(false);
        setMsg("Identifiants incorrects.", "err");
      }
    }, 700);
  });
});
