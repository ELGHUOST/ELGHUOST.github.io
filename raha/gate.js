// ⚠️ Front-end only, pas sécurisé, mais OK pour "site en construction"
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

function $(id){ return document.getElementById(id); }

function setMsg(text, type){
  const msg = $("msg");
  if (!msg) return;
  msg.textContent = text || "";
  msg.className = "msg" + (type ? ` ${type}` : "");
}

function showLoading(on){
  const loading = $("loading");
  if (!loading) return;
  loading.hidden = !on;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = $("loginForm");
  const userInput = $("username");
  const passInput = $("password");

  if (!form || !userInput || !passInput){
    console.error("gate.js: éléments manquants (loginForm/username/password).");
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setMsg("");

    const u = userInput.value.trim();
    const p = passInput.value;

    showLoading(true);

    // Sécurité: si un bug arrive, on coupe le loading au bout de 3s
    const safety = setTimeout(() => {
      showLoading(false);
      setMsg("Ça a pris trop de temps — ouvre F12 > Console pour voir l’erreur.", "err");
    }, 3000);

    setTimeout(() => {
      try{
        if (u === ADMIN_USER && p === ADMIN_PASS){
          localStorage.setItem("raha_auth", "1");
          clearTimeout(safety);
          setMsg("Accès autorisé. Redirection…", "ok");

          // Remplace l’historique pour éviter “retour” qui reboucle
          window.location.replace("index.html");
          return;
        }

        clearTimeout(safety);
        showLoading(false);
        setMsg("Identifiants incorrects.", "err");
      } catch (err){
        console.error(err);
        clearTimeout(safety);
        showLoading(false);
        setMsg("Erreur JS. Ouvre F12 > Console.", "err");
      }
    }, 700);
  });
});
