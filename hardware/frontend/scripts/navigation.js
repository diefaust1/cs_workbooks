(function () {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll("nav a").forEach((link) => {
    const linkPage = new URL(link.href, window.location.href).pathname.split("/").pop();
    if (linkPage === currentPage) {
      link.setAttribute("aria-current", "page");
    }
  });
})();
